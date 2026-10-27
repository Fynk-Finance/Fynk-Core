// Expo SDK 58 moved iOS to the scene based life cycle, so its AppDelegate template no longer has
// application(_:continue:restorationHandler:). react-native-app-auth 9.0.0's config plugin
// patches that method and fails the prebuild when it is missing. This plugin adds a pass-through
// override first. The sign-in itself does not need it: on iOS 13+ AppAuth gets the redirect
// from ASWebAuthenticationSession directly. Remove it once react-native-app-auth supports SDK 58.
const { withAppDelegate } = require('expo/config-plugins');

const METHOD = `
  // Added by plugins/withAppAuthSceneLifecycle.js for react-native-app-auth's config plugin.
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler)
  }`;

const FACTORY_LINE =
  /^\s*(?:public\s+)?var\s+reactNativeFactory\s*:\s*RCTReactNativeFactory\?\s*$/m;

function addContinueUserActivity(contents) {
  if (/continue\s+userActivity\s*:\s*NSUserActivity/.test(contents)) return contents;
  if (!FACTORY_LINE.test(contents)) {
    throw new Error('withAppAuthSceneLifecycle: reactNativeFactory not found in AppDelegate.swift');
  }
  return contents.replace(FACTORY_LINE, (line) => `${line}\n${METHOD}\n`);
}

function withAppAuthSceneLifecycle(config) {
  return withAppDelegate(config, (c) => {
    if (c.modResults.language === 'swift') {
      c.modResults.contents = addContinueUserActivity(c.modResults.contents);
    }
    return c;
  });
}

module.exports = withAppAuthSceneLifecycle;
module.exports.addContinueUserActivity = addContinueUserActivity;
