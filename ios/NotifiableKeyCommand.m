#import <React/RCTEventEmitter.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

static NSString *const NotifiableShowMarkEvent = @"notifiableShowMark";
static BOOL NotifiableShortcutEnabled = NO;

@class NotifiableKeyCommand;
static __weak NotifiableKeyCommand *NotifiableShortcutEmitter = nil;

@interface NotifiableKeyCommand : RCTEventEmitter
@property (nonatomic, assign) BOOL observing;
- (void)sendShowMark;
@end

@interface UIViewController (NotifiableShortcut)
- (void)notifiable_showMark:(UIKeyCommand *)command;
@end

@implementation UIViewController (NotifiableShortcut)

- (NSArray<UIKeyCommand *> *)notifiable_keyCommands
{
  NSArray<UIKeyCommand *> *commands = [self notifiable_keyCommands];

  if (!NotifiableShortcutEnabled) {
    return commands;
  }

  UIKeyCommand *showMark = [UIKeyCommand keyCommandWithInput:@"n"
                                               modifierFlags:UIKeyModifierCommand
                                                      action:@selector(notifiable_showMark:)];

  if ([showMark respondsToSelector:@selector(setWantsPriorityOverSystemBehavior:)]) {
    showMark.wantsPriorityOverSystemBehavior = YES;
  }

  if (commands == nil) {
    return @[ showMark ];
  }

  return [commands arrayByAddingObject:showMark];
}

- (void)notifiable_showMark:(__unused UIKeyCommand *)command
{
  [NotifiableShortcutEmitter sendShowMark];
}

@end

static void NotifiableInstallShortcut(void)
{
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class class = [UIViewController class];
    SEL original = @selector(keyCommands);
    SEL swizzled = @selector(notifiable_keyCommands);
    Method originalMethod = class_getInstanceMethod(class, original);
    Method swizzledMethod = class_getInstanceMethod(class, swizzled);
    BOOL didAdd = class_addMethod(
        class,
        original,
        method_getImplementation(swizzledMethod),
        method_getTypeEncoding(swizzledMethod));

    if (didAdd) {
      class_replaceMethod(
          class,
          swizzled,
          method_getImplementation(originalMethod),
          method_getTypeEncoding(originalMethod));
    } else {
      method_exchangeImplementations(originalMethod, swizzledMethod);
    }
  });
}

@implementation NotifiableKeyCommand

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ NotifiableShowMarkEvent ];
}

- (void)startObserving
{
  self.observing = YES;
  NotifiableShortcutEnabled = YES;
  NotifiableShortcutEmitter = self;
  NotifiableInstallShortcut();
}

- (void)stopObserving
{
  self.observing = NO;
  NotifiableShortcutEnabled = NO;
  NotifiableShortcutEmitter = nil;
}

- (void)sendShowMark
{
  if (!self.observing) {
    return;
  }

  [self sendEventWithName:NotifiableShowMarkEvent body:nil];
}

@end
