#include "platform_common.hpp"

#include <webview/webview.h>

#include <cctype>
#include <cstdio>
#include <filesystem>
#include <iostream>
#include <string>

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <wrl/client.h>
#include <WebView2.h>

namespace fs = std::filesystem;

namespace {

bool navigate_to_local_ui(webview::webview &window, const fs::path &ui_index) {
  const fs::path ui_dir = fs::absolute(ui_index.parent_path());

  auto controller_result = window.browser_controller();
  if (!controller_result.ok() || !controller_result.value()) {
    return false;
  }

  auto *controller =
      static_cast<ICoreWebView2Controller *>(controller_result.value());
  Microsoft::WRL::ComPtr<ICoreWebView2> webview;
  if (FAILED(controller->get_CoreWebView2(webview.GetAddressOf())) || !webview) {
    return false;
  }

  const std::wstring folder = ui_dir.wstring();
  const HRESULT map_result = webview->SetVirtualHostNameToFolderMapping(
      L"loop10.local", folder.c_str(),
      COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
  if (FAILED(map_result)) {
    return false;
  }

  window.navigate("https://loop10.local/index.html");
  return true;
}

webview::webview *g_window = nullptr;
HWND g_hwnd = nullptr;
HHOOK g_keyboard_hook = nullptr;
HHOOK g_mouse_hook = nullptr;
bool g_captured = false;
POINT g_last_mouse{0, 0};
bool g_mouse_initialized = false;

void eval_js(const std::string &js) {
  if (!g_window) {
    return;
  }
  g_window->dispatch([js]() {
    if (g_window) {
      g_window->eval(js);
    }
  });
}

void send_native_key(const char *key, bool down) {
  char buf[160];
  std::snprintf(
      buf, sizeof(buf),
      "if(window.onNativeKey)window.onNativeKey('%s',%s);", key,
      down ? "true" : "false");
  eval_js(buf);
}

void send_mouse_delta(double dx, double dy) {
  if (!dx && !dy) {
    return;
  }
  char buf[160];
  std::snprintf(
      buf, sizeof(buf),
      "if(window.onNativeMouseDelta)window.onNativeMouseDelta(%g,%g);", dx, dy);
  eval_js(buf);
}

void center_cursor() {
  if (!g_hwnd) {
    return;
  }
  RECT rect{};
  GetClientRect(g_hwnd, &rect);
  POINT center{
      rect.left + (rect.right - rect.left) / 2,
      rect.top + (rect.bottom - rect.top) / 2};
  ClientToScreen(g_hwnd, &center);
  SetCursorPos(center.x, center.y);
  g_last_mouse = center;
  g_mouse_initialized = true;
}

void clip_cursor_to_window() {
  if (!g_hwnd) {
    return;
  }
  RECT rect{};
  GetClientRect(g_hwnd, &rect);
  POINT tl{rect.left, rect.top};
  POINT br{rect.right, rect.bottom};
  ClientToScreen(g_hwnd, &tl);
  ClientToScreen(g_hwnd, &br);
  const RECT clip{tl.x, tl.y, br.x, br.y};
  ClipCursor(&clip);
}

void focus_game_window() {
  if (!g_hwnd) {
    return;
  }
  SetForegroundWindow(g_hwnd);
  SetFocus(g_hwnd);
  BringWindowToTop(g_hwnd);
}

void send_key_for_vk(DWORD vk, bool down) {
  if (vk == VK_ESCAPE) {
    send_native_key("escape", down);
    return;
  }
  if (vk == VK_SPACE) {
    send_native_key(" ", down);
    return;
  }

  BYTE keyboard_state[256]{};
  GetKeyboardState(keyboard_state);
  WCHAR chars[8]{};
  const int result =
      ToUnicode(static_cast<UINT>(vk), MapVirtualKey(vk, MAPVK_VK_TO_VSC),
                keyboard_state, chars, 8, 0);
  if (result > 0 && chars[0] < 128) {
    char key[2] = {static_cast<char>(std::tolower(
                       static_cast<unsigned char>(chars[0]))),
                   '\0'};
    if (key[0] != '\0') {
      send_native_key(key, down);
    }
  }
}

bool is_our_window_active() {
  if (!g_hwnd) {
    return false;
  }
  return GetForegroundWindow() == g_hwnd;
}

LRESULT CALLBACK keyboard_hook_proc(int code, WPARAM wparam, LPARAM lparam) {
  if (code >= 0 && g_window && is_our_window_active()) {
    const bool down = (wparam == WM_KEYDOWN || wparam == WM_SYSKEYDOWN);
    const bool up = (wparam == WM_KEYUP || wparam == WM_SYSKEYUP);
    if (down || up) {
      const auto *kbd = reinterpret_cast<const KBDLLHOOKSTRUCT *>(lparam);
      send_key_for_vk(kbd->vkCode, down);
      return 1;
    }
  }
  return CallNextHookEx(g_keyboard_hook, code, wparam, lparam);
}

LRESULT CALLBACK mouse_hook_proc(int code, WPARAM wparam, LPARAM lparam) {
  if (code >= 0 && g_captured && g_hwnd) {
    if (wparam == WM_MOUSEMOVE) {
      const auto *ms = reinterpret_cast<const MSLLHOOKSTRUCT *>(lparam);
      if (!g_mouse_initialized) {
        g_last_mouse = ms->pt;
        g_mouse_initialized = true;
        return 1;
      }
      const double dx = static_cast<double>(ms->pt.x - g_last_mouse.x);
      const double dy = static_cast<double>(ms->pt.y - g_last_mouse.y);
      send_mouse_delta(dx, dy);
      center_cursor();
      return 1;
    }
  }
  return CallNextHookEx(g_mouse_hook, code, wparam, lparam);
}

void install_keyboard_hook() {
  if (g_keyboard_hook) {
    return;
  }
  g_keyboard_hook = SetWindowsHookExW(WH_KEYBOARD_LL, keyboard_hook_proc,
                                      GetModuleHandleW(nullptr), 0);
}

void install_mouse_hook() {
  if (g_mouse_hook) {
    return;
  }
  g_mouse_hook = SetWindowsHookExW(WH_MOUSE_LL, mouse_hook_proc,
                                   GetModuleHandleW(nullptr), 0);
}

void release_mouse_capture() {
  if (!g_captured) {
    return;
  }
  g_captured = false;
  g_mouse_initialized = false;
  ClipCursor(nullptr);
  ShowCursor(TRUE);
  if (g_mouse_hook) {
    UnhookWindowsHookEx(g_mouse_hook);
    g_mouse_hook = nullptr;
  }
}

void capture_mouse() {
  if (g_captured || !g_hwnd) {
    return;
  }
  focus_game_window();
  g_captured = true;
  ShowCursor(FALSE);
  clip_cursor_to_window();
  center_cursor();
  install_mouse_hook();
}

void begin_play() {
  install_keyboard_hook();
  focus_game_window();
  capture_mouse();
}

void setup_desktop_input() {
  install_keyboard_hook();
  focus_game_window();
}

} // namespace

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
  try {
    const fs::path project_root = PROJECT_ROOT;
    const fs::path ui_index = resolve_ui_index(project_root);

    if (ui_index.empty() || !fs::exists(ui_index)) {
      MessageBoxW(nullptr, L"Missing ui/index.html next to loop10.exe.",
                  L"Loop 10", MB_ICONERROR | MB_OK);
      return 1;
    }

    webview::webview window(false, nullptr);
    g_window = &window;

    auto hwnd_result = window.window();
    if (hwnd_result.ok() && hwnd_result.value()) {
      g_hwnd = static_cast<HWND>(hwnd_result.value());
    }

    window.set_title("Loop 10");
    window.set_size(1280, 720, WEBVIEW_HINT_NONE);

    window.bind("nativeQuit", [&window](const std::string &) -> std::string {
      release_mouse_capture();
      if (g_keyboard_hook) {
        UnhookWindowsHookEx(g_keyboard_hook);
        g_keyboard_hook = nullptr;
      }
      window.dispatch([&window]() { window.terminate(); });
      return "{\"ok\":true}";
    });

    window.bind("nativeBeginPlay", [](const std::string &) -> std::string {
      begin_play();
      return "{\"ok\":true}";
    });

    window.bind("nativeCaptureMouse", [](const std::string &) -> std::string {
      capture_mouse();
      return "{\"ok\":true}";
    });

    window.bind("nativeReleaseMouse", [](const std::string &) -> std::string {
      release_mouse_capture();
      return "{\"ok\":true}";
    });

    if (!navigate_to_local_ui(window, ui_index)) {
      window.navigate(file_uri_for(ui_index));
    }
    window.dispatch([]() { setup_desktop_input(); });
    window.run();

    release_mouse_capture();
    if (g_keyboard_hook) {
      UnhookWindowsHookEx(g_keyboard_hook);
      g_keyboard_hook = nullptr;
    }
    g_window = nullptr;
    g_hwnd = nullptr;
  } catch (const std::exception &e) {
    std::cerr << "Fatal: " << e.what() << '\n';
    return 1;
  } catch (...) {
    std::cerr << "Fatal: unknown error\n";
    return 1;
  }

  return 0;
}
