const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const launchBackground = '#F7FBFE';

/**
 * Android 12+ always provides a system launch window. This replaces its app
 * icon with a transparent drawable and matches the first screen's background,
 * so the mandatory window is not visible as an Expo splash screen.
 */
module.exports = function withNoSplashScreen(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const resDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res'
      );
      const valuesV31Dir = path.join(resDir, 'values-v31');
      const drawableDir = path.join(resDir, 'drawable');

      fs.mkdirSync(valuesV31Dir, { recursive: true });
      fs.mkdirSync(drawableDir, { recursive: true });

      fs.writeFileSync(
        path.join(valuesV31Dir, 'styles.xml'),
        `<resources xmlns:tools="http://schemas.android.com/tools">
  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:enforceNavigationBarContrast" tools:targetApi="29">true</item>
    <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>
    <item name="colorPrimary">@color/colorPrimary</item>
    <item name="android:windowBackground">${launchBackground}</item>
    <item name="android:statusBarColor">#ffffff</item>
    <item name="android:windowSplashScreenBackground">${launchBackground}</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/transparent_splash_icon</item>
  </style>
</resources>
`
      );

      fs.writeFileSync(
        path.join(drawableDir, 'transparent_splash_icon.xml'),
        `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="1dp"
    android:height="1dp"
    android:viewportWidth="1"
    android:viewportHeight="1">
  <path
      android:fillColor="@android:color/transparent"
      android:pathData="M0,0h1v1h-1z" />
</vector>
`
      );

      return modConfig;
    },
  ]);
};
