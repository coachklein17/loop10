#include "platform_common.hpp"

#include <cctype>

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#elif defined(__APPLE__)
#include <mach-o/dyld.h>
#endif

namespace fs = std::filesystem;

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
  const std::string encoded = url_encode(absolute.string());
#if defined(_WIN32)
  // WebView2 expects file:///C:/... on Windows.
  if (encoded.size() >= 2 && std::isalpha(static_cast<unsigned char>(encoded[0])) &&
      encoded[1] == ':') {
    return "file:///" + encoded;
  }
#endif
  return "file://" + encoded;
}

fs::path executable_dir() {
#if defined(_WIN32)
  wchar_t buffer[MAX_PATH];
  const DWORD len = GetModuleFileNameW(nullptr, buffer, MAX_PATH);
  if (len == 0 || len >= MAX_PATH) {
    return fs::current_path();
  }
  return fs::path(buffer).parent_path();
#elif defined(__APPLE__)
  char buffer[4096];
  uint32_t size = sizeof(buffer);
  if (_NSGetExecutablePath(buffer, &size) == 0) {
    return fs::path(buffer).parent_path();
  }
#endif
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
