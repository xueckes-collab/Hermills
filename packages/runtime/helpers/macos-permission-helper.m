#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>

static NSString *const kScreenRecordingSettingsURL = @"x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
static NSString *const kAccessibilitySettingsURL = @"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

static void OpenSettings(NSString *urlString) {
  NSURL *url = [NSURL URLWithString:urlString];
  if (url) {
    [[NSWorkspace sharedWorkspace] openURL:url];
  }
}

static NSString *ScreenRecordingState(void) {
  if (@available(macOS 10.15, *)) {
    return CGPreflightScreenCaptureAccess() ? @"granted" : @"missing";
  }
  return @"unknown";
}

static NSString *AccessibilityState(void) {
  return AXIsProcessTrusted() ? @"granted" : @"missing";
}

static void RequestScreenRecording(void) {
  if (@available(macOS 10.15, *)) {
    CGRequestScreenCaptureAccess();
    if (!CGPreflightScreenCaptureAccess()) {
      OpenSettings(kScreenRecordingSettingsURL);
    }
  } else {
    OpenSettings(kScreenRecordingSettingsURL);
  }
}

static void RequestAccessibility(void) {
  NSDictionary *options = @{ (__bridge NSString *)kAXTrustedCheckOptionPrompt: @YES };
  AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
  if (!AXIsProcessTrusted()) {
    OpenSettings(kAccessibilitySettingsURL);
  }
}

static void EmitStatus(void) {
  NSDictionary *payload = @{
    @"screenRecording": ScreenRecordingState(),
    @"accessibility": AccessibilityState(),
    @"automation": @"unknown",
    @"files": @"workspace-only"
  };
  NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:NSJSONWritingSortedKeys error:nil];
  if (!data) {
    fputs("{\"screenRecording\":\"unknown\",\"accessibility\":\"unknown\",\"automation\":\"unknown\",\"files\":\"workspace-only\"}\n", stdout);
    return;
  }
  fwrite(data.bytes, 1, data.length, stdout);
  fputs("\n", stdout);
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    NSString *action = argc > 1 ? [NSString stringWithUTF8String:argv[1]] : @"status";
    if ([action isEqualToString:@"status"]) {
      EmitStatus();
      return 0;
    }
    if ([action isEqualToString:@"request-screen-recording"]) {
      RequestScreenRecording();
      EmitStatus();
      return 0;
    }
    if ([action isEqualToString:@"request-accessibility"]) {
      RequestAccessibility();
      EmitStatus();
      return 0;
    }
    if ([action isEqualToString:@"open-screen-recording-settings"]) {
      OpenSettings(kScreenRecordingSettingsURL);
      EmitStatus();
      return 0;
    }
    if ([action isEqualToString:@"open-accessibility-settings"]) {
      OpenSettings(kAccessibilitySettingsURL);
      EmitStatus();
      return 0;
    }
    fputs("Unknown permission helper action.\n", stderr);
    return 64;
  }
}
