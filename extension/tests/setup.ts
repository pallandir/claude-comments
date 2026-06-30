Object.assign(globalThis, {
  chrome: {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
      },
      session: {
        get: async () => ({}),
        set: async () => {},
      },
    },
    runtime: {
      id: "test-extension-id",
      sendMessage: async () => {},
    },
    scripting: {},
  },
});
