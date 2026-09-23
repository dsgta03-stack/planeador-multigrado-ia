// Safe checked-in default. The explicit deployment tool injects an expiring,
// scoped credential hash into this shadow-only bundle; never a cleartext secret.
export const config = {enabled:false,tokenHash:'',identity:'multiplan-blueprint-shadow-test-v1',expiresAt:0};
