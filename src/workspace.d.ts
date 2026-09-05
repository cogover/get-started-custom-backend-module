declare module "@cogover/sdk" {
  interface WorkspaceObjects {
    lead: {
      name: string;
      first_name: string | null;
      last_name: string;
      status: string | null;
      emails: string[] | null;
    };
  }
}

export {};
