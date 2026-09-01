const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp({
  databaseURL: "https://clubinvoicecalculator-default-rtdb.asia-southeast1.firebasedatabase.app"
});

exports.submitCertificate = onCall(
  {
    region: "asia-southeast1"
  },
  async (request) => {
    // 1. Authenticate Request
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    
    if (!data || !data.email || !data.name) {
        throw new HttpsError('invalid-argument', 'Name and email are required.');
    }

    try {
      // 2. Format the date string: e.g. "August 31, 2026"
      const dateStr = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: '2-digit',
        year: 'numeric'
      }).format(new Date());

      // 3. Construct the payload
      const payload = {
        name: data.name,
        lookup: data.email, // using learner email as lookup
        templateKey: "cert",
        additionalFields: {
          club: data.clubName || "",
          district: data.district || "",
          role: data.role || "",
          date: dateStr
        }
      };

      // 4. Send the webhook request synchronously
      const response = await fetch("https://certify.rsamdio.org/api/webhooks/activities/clubinvoicebasics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.WEBHOOK_SECRET}`
        },
        body: JSON.stringify(payload)
      });

      // 5. Handle webhook failure
      if (!response.ok) {
        const text = await response.text();
        console.error(`Webhook failed with status ${response.status}: ${text}`);
        throw new HttpsError('invalid-argument', `Certification failed: ${text || 'Please check your details.'}`);
      }

      // 6. Write success to RTDB natively to record the completion permanently
      const dbRef = admin.database().ref(`/completions/${uid}`);
      await dbRef.set({
        ...data,
        uid: uid,
        submittedAt: admin.database.ServerValue.TIMESTAMP,
        webhookStatus: "delivered"
      });

      // 7. Increment the global completions counter
      const countRef = admin.database().ref('/stats/completionsCount');
      await countRef.set(admin.database.ServerValue.increment(1));

      console.log(`Successfully dispatched certificate for ${data.email}`);
      return { success: true };
      
    } catch (error) {
      console.error("Error in submitCertificate:", error);
      // Propagate HttpsError directly, otherwise wrap in internal error
      if (error instanceof HttpsError) {
          throw error;
      }
      throw new HttpsError('internal', 'An internal error occurred during submission.');
    }
  }
);
