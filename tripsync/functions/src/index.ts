import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {logger} from "firebase-functions";

initializeApp();

export const onMemberWrite = onDocumentWritten(
  "events/{eventId}/members/{uid}",
  async (event) => {
    const eventId = event.params.eventId;
    const uid = event.params.uid;

    const afterExists = event.data?.after?.exists ?? false;
    const shouldHaveClaim = afterExists;

    try {
      const auth = getAuth();
      const user = await auth.getUser(uid);
      const oldClaims =
        (user.customClaims || {}) as Record<string, unknown>;
      const oldEvents =
        (oldClaims.events as Record<string, boolean>) || {};
      const events = {...oldEvents};

      if (shouldHaveClaim) {
        events[eventId] = true;
      } else {
        delete events[eventId];
      }

      const newClaims = {...oldClaims, events};
      await auth.setCustomUserClaims(uid, newClaims);
      logger.info("claims updated", {uid, eventId, shouldHaveClaim});
    } catch (err) {
      logger.error("setCustomUserClaims failed", {uid, eventId, err});
      throw err;
    }
  }
);
