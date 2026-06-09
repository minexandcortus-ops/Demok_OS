import * as admin from 'firebase-admin';

async function run() {
    try {
        const serviceAccount = require('./demok-firebase-service-account.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        
        const listUsersResult = await admin.auth().listUsers(100);
        listUsersResult.users.forEach((userRecord) => {
            console.log('user', userRecord.email, userRecord.uid);
            if (userRecord.email && userRecord.email.includes('mag')) {
                console.log('FOUND:', userRecord.email);
            }
        });
    } catch(e) {
        console.error('Error init:', e.message);
    }
}
run();
