#include <webview/webview.h>

#include <cctype>
#include <cstdio>
#include <filesystem>
#include <iostream>
#include <string>

#include <mach-o/dyld.h>

namespace fs = std::filesystem;

namespace {

std::string url_encode(const std::string &native) {
  std::string encoded;
  encoded.reserve(native.size() + 16);
  constexpr char kHex[] = "0123456789ABCDEF";

  for (unsigned char ch : native) {
    if (ch == '\\') {
      encoded.push_back('/');
      continue;
    }

    const bool is_unreserved =
        (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') ||
        (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' || ch == '.' ||
        ch == '/' || ch == '~';

    if (is_unreserved) {
      encoded.push_back(static_cast<char>(ch));
    } else {
      encoded.push_back('%');
      encoded.push_back(kHex[(ch >> 4) & 0x0F]);
      encoded.push_back(kHex[ch & 0x0F]);
    }
  }
  return encoded;
}

std::string file_uri_for(const fs::path &path) {
  const auto absolute = fs::absolute(path).lexically_normal();
  return "file://" + url_encode(absolute.string());
}

fs::path executable_dir() {
  char buffer[4096];
  uint32_t size = sizeof(buffer);
  if (_NSGetExecutablePath(buffer, &size) == 0) {
    return fs::path(buffer).parent_path();
  }
  return fs::current_path();
}

fs::path resolve_ui_index(const fs::path &project_root) {
  const fs::path exe_dir = executable_dir();
  const fs::path candidates[] = {
      (exe_dir / "ui" / "index.html").lexically_normal(),
#if defined(__APPLE__)
      (exe_dir / ".." / "Resources" / "ui" / "index.html").lexically_normal(),
#endif
      (project_root / "ui" / "index.html").lexically_normal(),
  };

  for (const auto &candidate : candidates) {
    if (fs::exists(candidate)) {
      return candidate;
    }
  }
  return {};
}

} // namespace

#if defined(__APPLE__)
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>

struct AppInputState {
  webview::webview *window = nullptr;
  NSWindow *ns_window = nullptr;
  id move_monitor = nil;
  id key_monitor = nil;
  bool captured = false;
};

AppInputState g_input;

void eval_js(const std::string &js) {
  if (!g_input.window) {
    return;
  }
  g_input.window->dispatch([js]() {
    if (g_input.window) {
      g_input.window->eval(js);
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
  if (!g_input.ns_window) {
    return;
  }
  const NSRect frame = [g_input.ns_window frame];
  const CGPoint center = CGPointMake(NSMidX(frame), NSMidY(frame));
  CGWarpMouseCursorPosition(center);
}

void focus_game_window() {
  if (!g_input.window) {
    return;
  }

  auto win = g_input.window->window();
  if (!win.ok() || !win.value()) {
    return;
  }

  g_input.ns_window = (__bridge NSWindow *)win.value();
  [NSApp activateIgnoringOtherApps:YES];
  [g_input.ns_window makeKeyAndOrderFront:nil];

  auto widget = g_input.window->widget();
  if (widget.ok() && widget.value()) {
    NSView *webview_widget = (__bridge NSView *)widget.value();
    [g_input.ns_window makeFirstResponder:webview_widget];
  } else {
    [g_input.ns_window makeFirstResponder:[g_input.ns_window contentView]];
  }
}

void install_key_forwarder() {
  if (g_input.key_monitor) {
    return;
  }

  g_input.key_monitor = [NSEvent
      addLocalMonitorForEventsMatchingMask:NSEventMaskKeyDown | NSEventMaskKeyUp
                                   handler:^NSEvent *(NSEvent *event) {
                                     if (!g_input.window) {
                                       return event;
                                     }

                                     auto win = g_input.window->window();
                                     if (!win.ok() || !win.value()) {
                                       return event;
                                     }

                                     NSWindow *nsw = (__bridge NSWindow *)win.value();
                                     if ([NSApp keyWindow] != nsw) {
                                       return event;
                                     }

                                     const bool down =
                                         event.type == NSEventTypeKeyDown;

                                     if (event.keyCode == 53) {
                                       send_native_key("escape", down);
                                       return nil;
                                     }
                                     if (event.keyCode == 49) {
                                       send_native_key(" ", down);
                                       return nil;
                                     }

                                     NSString *chars =
                                         event.charactersIgnoringModifiers;
                                     if (chars.length == 0) {
                                       return event;
                                     }

                                     const char keych = static_cast<char>(std::tolower(
                                         [chars characterAtIndex:0]));
                                     if (keych == 0) {
                                       return event;
                                     }

                                     char keystr[2] = {keych, '\0'};
                                     send_native_key(keystr, down);
                                     return nil;
                                   }];
}

void release_mouse_capture() {
  if (!g_input.captured) {
    return;
  }
  g_input.captured = false;
  if (g_input.move_monitor) {
    [NSEvent removeMonitor:g_input.move_monitor];
    g_input.move_monitor = nil;
  }
  CGAssociateMouseAndMouseCursorPosition(YES);
  [NSCursor unhide];
}

void capture_mouse() {
  if (g_input.captured || !g_input.window) {
    return;
  }

  focus_game_window();
  if (!g_input.ns_window) {
    return;
  }

  g_input.captured = true;
  [NSCursor hide];
  CGAssociateMouseAndMouseCursorPosition(NO);
  center_cursor();

  g_input.move_monitor = [NSEvent
      addLocalMonitorForEventsMatchingMask:NSEventMaskMouseMoved
                                   handler:^NSEvent *(NSEvent *event) {
                                     if (!g_input.captured) {
                                       return event;
                                     }
                                     send_mouse_delta(event.deltaX, event.deltaY);
                                     center_cursor();
                                     return event;
                                   }];
}

void begin_play() {
  install_key_forwarder();
  focus_game_window();
  capture_mouse();
}

void setup_desktop_input() {
  install_key_forwarder();
  focus_game_window();
}
#endif

int main() {
  try {
    const fs::path ui_index =
        resolve_ui_index(fs::path(PROJECT_ROOT));

    if (ui_index.empty() || !fs::exists(ui_index)) {
      std::cerr << "Missing UI entry. Checked bundle Resources/ui and MacOS/ui.\n";
      return 1;
    }

    const std::string entry_url = file_uri_for(ui_index);

    webview::webview window(false, nullptr);
#if defined(__APPLE__)
    g_input.window = &window;
#endif

    window.set_title("Loop 10");
    window.set_size(1280, 720, WEBVIEW_HINT_NONE);

    window.bind("nativeQuit", [&window](const std::string &) -> std::string {
      window.dispatch([&window]() {
#if defined(__APPLE__)
        release_mouse_capture();
#endif
        window.terminate();
      });
      return "{\"ok\":true}";
    });

#if defined(__APPLE__)
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
#endif

    window.navigate(entry_url);
#if defined(__APPLE__)
    window.dispatch([]() { setup_desktop_input(); });
#endif
    window.run();
  } catch (const std::exception &e) {
    std::cerr << "Fatal: " << e.what() << '\n';
    return 1;
  } catch (...) {
    std::cerr << "Fatal: unknown error\n";
    return 1;
  }

  return 0;
}
