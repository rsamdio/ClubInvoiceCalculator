const admin = require("firebase-admin");
admin.initializeApp({ projectId: "clubinvoicecalculator", databaseURL: "https://clubinvoicecalculator-default-rtdb.asia-southeast1.firebasedatabase.app" });
async function test() {
  try {
    const dbRef = admin.database().ref(`/test/uid123`);
    await dbRef.set({ time: admin.database.ServerValue.TIMESTAMP });
    const countRef = admin.database().ref('/test/count');
    await countRef.set(admin.database.ServerValue.increment(1));
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
test();
