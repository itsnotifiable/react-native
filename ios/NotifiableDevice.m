#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>
#import <ifaddrs.h>
#import <arpa/inet.h>
#import <net/if.h>
#import <sys/utsname.h>

@interface NotifiableDevice : NSObject <RCTBridgeModule>
@end

@implementation NotifiableDevice

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(getInfo:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  (void)reject;
  struct utsname system;
  NSString *model = nil;

  if (uname(&system) == 0) {
    model = [NSString stringWithCString:system.machine encoding:NSUTF8StringEncoding];
  }

  NSString *version = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];

  NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier];

  resolve(@{
    @"model": model != nil ? model : [NSNull null],
    @"manufacturer": @"Apple",
    @"appVersion": [version isKindOfClass:[NSString class]] ? version : [NSNull null],
    @"applicationId": bundleId != nil ? bundleId : [NSNull null],
    @"ip": [NotifiableDevice deviceAddress] ?: [NSNull null],
  });
}

+ (NSString *)deviceAddress
{
  struct ifaddrs *interfaces = NULL;

  if (getifaddrs(&interfaces) != 0) {
    return nil;
  }

  NSString *address = nil;

  for (struct ifaddrs *cursor = interfaces; cursor != NULL; cursor = cursor->ifa_next) {
    if (cursor->ifa_addr == NULL || cursor->ifa_addr->sa_family != AF_INET) {
      continue;
    }

    if ((cursor->ifa_flags & IFF_UP) == 0 || (cursor->ifa_flags & IFF_LOOPBACK) != 0) {
      continue;
    }

    char buffer[INET_ADDRSTRLEN];
    const struct sockaddr_in *socketAddress = (const struct sockaddr_in *)cursor->ifa_addr;

    if (inet_ntop(AF_INET, &socketAddress->sin_addr, buffer, sizeof(buffer)) == NULL) {
      continue;
    }

    NSString *candidate = [NSString stringWithUTF8String:buffer];

    if (candidate.length == 0 || [candidate isEqualToString:@"0.0.0.0"] || [candidate hasPrefix:@"127."]) {
      continue;
    }

    address = candidate;
    break;
  }

  freeifaddrs(interfaces);
  return address;
}

RCT_EXPORT_METHOD(copy:(NSString *)text)
{
  if (text.length == 0) {
    return;
  }

  [UIPasteboard generalPasteboard].string = text;
}

@end
