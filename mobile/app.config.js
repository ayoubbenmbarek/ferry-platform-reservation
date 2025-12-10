export default {
  expo: {
    name: "VoilaFerry",
    slug: "voilaferry",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "voilaferry",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.voilaferry.app",
      infoPlist: {
        NSFaceIDUsageDescription: "Sign in quickly and securely using Face ID"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.voilaferry.app"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-dev-client",
      "expo-secure-store",
      "expo-web-browser",
      "expo-font"
    ],
    extra: {
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      // apiBaseUrl removed - auto-detected from Expo hostUri for physical devices
      eas: {
        projectId: "575f19a7-cd2f-4df9-8da0-cf8d962a5d72"
      }
    }
  }
};
