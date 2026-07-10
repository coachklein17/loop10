#pragma once

#include <filesystem>
#include <string>

std::string url_encode(const std::string &native);
std::string file_uri_for(const std::filesystem::path &path);
std::filesystem::path executable_dir();
std::filesystem::path resolve_ui_index(const std::filesystem::path &project_root);
