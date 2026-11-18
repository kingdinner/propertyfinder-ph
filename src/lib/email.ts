export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
};

const sent: OutboundEmail[] = [];

export function getSentEmails() {
  return [...sent];
}

export function clearSentEmails() {
  sent.length = 0;
}

export async function sendEmail(message: OutboundEmail): Promise<void> {
  sent.push(message);
  if (process.env.NODE_ENV !== "test") {
    console.info(`[email] to=${message.to} subject=${message.subject}\n${message.text}`);
  }
}
