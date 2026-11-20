export type Invite = {
  personName: string
  projectName: string
  address: string
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

export function inviteMessage({ personName, projectName, address }: Invite): string {
  return [
    `Hi ${firstName(personName)}, you're on "${projectName}" in A-Line: one coach that gets the brief, scope and budget straight before work starts. You talk to it from your own AI, Claude or ChatGPT.`,
    `1. Add this link as a custom connector. In Claude: Settings, Connectors, Add custom connector. In ChatGPT: Settings, Connectors, add a custom connector.\n${address}`,
    '2. Start a new chat and say: "Open my A-Line room."',
    "The link is yours alone and works like a password, so please don't pass it on.",
  ].join('\n\n')
}

export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
