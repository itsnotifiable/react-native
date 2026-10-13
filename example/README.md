# Notifiable example

React Native app that loads `@notifiable/react-native` from the parent folder.

The Notifiable API should be running at `http://127.0.0.1:8000`. The iOS simulator uses that address. The Android emulator uses `http://10.0.2.2:8000/api`. A phone on the same network needs your computer's LAN address in the API base URL field.

```sh
cd example
npm install
npm start
```

In another terminal:

```sh
cd example
npm run ios
# or
npm run android
```

iOS also needs CocoaPods once:

```sh
cd example/ios
pod install
```

Enter the app public key on the first screen, then connect. The app registers a subscriber even if you deny notification permission. Allow uses a sample device token so you can test the granted path without Firebase or APNs.
