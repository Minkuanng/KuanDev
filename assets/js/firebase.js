// Shared Firebase configuration and initialization
const firebaseConfig = {
    apiKey: "AIzaSyCPDDRt520fSynXCGrr2aF-KvpnS_ZuIm8",
    authDomain: "shop-c6777.firebaseapp.com",
    databaseURL: "https://shop-c6777-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "shop-c6777",
    storageBucket: "shop-c6777.firebasestorage.app",
    messagingSenderId: "43186563268",
    appId: "1:43186563268:web:0d392ba57039a919670191"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();
