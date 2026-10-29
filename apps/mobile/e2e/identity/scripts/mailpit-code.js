/* global output, http, json, MAILPIT_URL -- provided by Maestro's runScript */
// Reads the 6 digit code of the newest email sent to output.email from the local Mailpit.
// The address is matched in the response, not sent in a query string. Throws while the email has
// not arrived, so the flow's retry runs it again.
const list = json(http.get(MAILPIT_URL + '/api/v1/messages?limit=50').body);
const sent = (list.messages || []).find(function (m) {
  return (m.To || []).some(function (to) {
    return to.Address === output.email;
  });
});
if (!sent) throw new Error('the code email has not arrived yet');

const message = json(http.get(MAILPIT_URL + '/api/v1/message/' + sent.ID).body);
// The code sits on its own line of the text part, as the Keycloak integration tests read it.
const match = /^\s*(\d{6})\s*$/m.exec(message.Text || '');
if (!match) throw new Error('the code email has no 6 digit code');
output.code = match[1];
