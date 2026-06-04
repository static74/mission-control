import streamDeck from "@elgato/streamdeck";

import { MeetingCountdownAction } from "./actions/meeting-countdown";

// NOTE: we deliberately do NOT call streamDeck.logger.setLevel("trace").
// At "trace" the SDK serializes every WebSocket frame to the on-disk plugin log,
// and the settings frames carry the secret iCal URL (a read credential for the
// whole calendar). The default level ("info") keeps that credential off disk.

streamDeck.actions.registerAction(new MeetingCountdownAction());

streamDeck.connect();
