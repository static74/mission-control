import streamDeck from "@elgato/streamdeck";

import { MeetingCountdownAction } from "./actions/meeting-countdown";

// NOTE: we deliberately do NOT call streamDeck.logger.setLevel("trace").
// The SDK serializes raw WebSocket frames to the on-disk plugin log only at
// "trace" (connection.js); those frames carry the settings payload, i.e. the
// secret iCal URL (a read credential for the whole calendar). No SDK path logs
// settings at info/debug/warn/error. This plugin runs at "debug" (the manifest
// enables Nodejs.Debug), and "trace" is below "debug" so it is suppressed,
// keeping the credential off disk. Setting the level to "trace" would leak it.

streamDeck.actions.registerAction(new MeetingCountdownAction());

streamDeck.connect();
