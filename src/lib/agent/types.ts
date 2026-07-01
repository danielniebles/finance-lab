// Channel-agnostic proposal types — knows nothing about React or Telegram.

export type ProposalChoice = {
  id: "approve" | "dismiss";
  label: string;
  style?: "primary" | "danger";
};

export type ProposalDescriptor = {
  id: string; // = persisted PendingProposal.id
  action: string;
  params: Record<string, unknown>;
  title: string;
  fields: { label: string; value: string }[];
  reasoning: string;
  choices: ProposalChoice[];
};

export type AgentTurnResult = {
  text: string;
  proposals: ProposalDescriptor[];
};
