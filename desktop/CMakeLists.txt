cmake_minimum_required(VERSION 3.16)

if(WIN32)
  project(loop10 VERSION 1.0.0 LANGUAGES CXX)
else()
  project(loop10 VERSION 1.0.0 LANGUAGES CXX OBJCXX)
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(APPLE)
  set(CMAKE_OSX_DEPLOYMENT_TARGET "13.0" CACHE STRING "" FORCE)
  if(NOT CMAKE_OSX_ARCHITECTURES)
    if(CMAKE_HOST_SYSTEM_PROCESSOR MATCHES "arm64")
      set(CMAKE_OSX_ARCHITECTURES "arm64" CACHE STRING "" FORCE)
    else()
      set(CMAKE_OSX_ARCHITECTURES "x86_64" CACHE STRING "" FORCE)
    endif()
  endif()

  if(NOT CMAKE_OSX_SYSROOT)
    execute_process(
      COMMAND xcrun --show-sdk-path
      OUTPUT_VARIABLE _LOOP10_SDK_ROOT
      OUTPUT_STRIP_TRAILING_WHITESPACE)
    if(_LOOP10_SDK_ROOT)
      set(CMAKE_OSX_SYSROOT "${_LOOP10_SDK_ROOT}" CACHE PATH "" FORCE)
    endif()
  endif()

  if(CMAKE_OSX_SYSROOT AND EXISTS "${CMAKE_OSX_SYSROOT}/usr/include/c++/v1")
    add_compile_options(
      "SHELL:-isysroot ${CMAKE_OSX_SYSROOT}"
      "SHELL:-I${CMAKE_OSX_SYSROOT}/usr/include/c++/v1")
  endif()
endif()

if(NOT EXISTS "${CMAKE_SOURCE_DIR}/../vendor/webview/CMakeLists.txt")
  message(FATAL_ERROR
    "Missing vendor/webview. Run: ./scripts/setup-vendor.sh")
endif()

set(WEBVIEW_BUILD ON CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_DOCS OFF CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_SHARED_LIBRARY OFF CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_STATIC_LIBRARY ON CACHE BOOL "" FORCE)
add_subdirectory(
  ${CMAKE_SOURCE_DIR}/../vendor/webview
  ${CMAKE_BINARY_DIR}/webview
  EXCLUDE_FROM_ALL)

set(PROJECT_ROOT "${CMAKE_SOURCE_DIR}/..")
string(REPLACE "\\" "/" PROJECT_ROOT "${PROJECT_ROOT}")

set(LOOP10_UI_DIR "${CMAKE_SOURCE_DIR}/../ui")

set(LOOP10_ICON_ICNS "${CMAKE_SOURCE_DIR}/icons/loop10.icns")
set(LOOP10_ICON_ICO "${CMAKE_SOURCE_DIR}/icons/loop10.ico")

if(WIN32)
  add_executable(loop10 WIN32
    main_win.cpp
    platform_common.cpp
    loop10.rc
  )

  target_link_libraries(loop10 PRIVATE webview::core_static)

  add_custom_command(TARGET loop10 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
      ${LOOP10_UI_DIR}
      $<TARGET_FILE_DIR:loop10>/ui
    COMMENT "Copy ui/ next to loop10.exe"
  )
elseif(APPLE)
  find_library(WEBKIT_FRAMEWORK WebKit)
  find_library(COCOA_FRAMEWORK Cocoa)
  find_library(FOUNDATION_FRAMEWORK Foundation)
  find_library(COREGRAPHICS_FRAMEWORK CoreGraphics)

  set_source_files_properties(${LOOP10_ICON_ICNS} PROPERTIES
    MACOSX_PACKAGE_LOCATION "Resources")

  add_executable(loop10 MACOSX_BUNDLE
    main.mm
    ${LOOP10_ICON_ICNS}
  )

  set_target_properties(loop10 PROPERTIES
    MACOSX_BUNDLE TRUE
    MACOSX_BUNDLE_GUI_IDENTIFIER "com.loop10.game"
    MACOSX_BUNDLE_BUNDLE_NAME "Loop 10"
    MACOSX_BUNDLE_ICON_FILE "loop10.icns"
    MACOSX_BUNDLE_SHORT_VERSION_STRING "${PROJECT_VERSION}"
    MACOSX_BUNDLE_BUNDLE_VERSION "${PROJECT_VERSION}"
  )

  target_link_libraries(loop10 PRIVATE
    webview::core_static
    ${WEBKIT_FRAMEWORK}
    ${COCOA_FRAMEWORK}
    ${FOUNDATION_FRAMEWORK}
    ${COREGRAPHICS_FRAMEWORK}
  )

  add_custom_command(TARGET loop10 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
      ${LOOP10_UI_DIR}
      $<TARGET_FILE_DIR:loop10>/ui
    COMMAND ${CMAKE_COMMAND} -E copy_directory
      ${LOOP10_UI_DIR}
      $<TARGET_BUNDLE_CONTENT_DIR:loop10>/Resources/ui
    COMMENT "Copy ui/ into app bundle and binary directory"
  )
else()
  message(FATAL_ERROR "Unsupported platform. Build on macOS or Windows.")
endif()

target_compile_definitions(loop10 PRIVATE PROJECT_ROOT="${PROJECT_ROOT}")
