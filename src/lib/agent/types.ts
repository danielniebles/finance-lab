// Channel-agnostic proposal types — knows nothing about React or Telegram.

export type ProposalChoice = {
  id: "approve" | "dismiss";
  label: string;
  style?: "primary" | "danger";
};

export type EditableOption = { id: string; label: string };

export type EditableField = {
  field: string; // e.g. "appCategoryId" — key into params to update on edit
  label: string; // e.g. "Categoría"
  selectedId: string; // current value (the agent's guess)
  options: EditableOption[]; // shortlist, incl. synthetic "__other__" last
};

export type ProposalDescriptor = {
  id: string; // = persisted PendingProposal.id
  action: string;
  params: Record<string, unknown>;
  title: string;
  fields: { label: string; value: string }[];
  reasoning: string;
  choices: ProposalChoice[];
  /** Fields the user can change directly on the card (e.g. category) before approving. */
  editable?: EditableField[];
};

export type AgentTurnResult = {
  text: string;
  proposals: ProposalDescriptor[];
};
