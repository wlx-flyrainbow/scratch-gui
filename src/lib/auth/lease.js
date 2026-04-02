const DAY_MS = 24 * 60 * 60 * 1000;

const buildLease = (entitlement, leaseDays) => {
    const now = Date.now();
    const offlineUntil = now + (leaseDays * DAY_MS);
    return {
        ...entitlement,
        lease: {
            issuedAt: new Date(now).toISOString(),
            expiresAt: new Date(offlineUntil).toISOString()
        }
    };
};

const isLeaseValid = entitlement => {
    if (!entitlement || !entitlement.lease || !entitlement.lease.expiresAt) return false;
    return Date.now() < Date.parse(entitlement.lease.expiresAt);
};

export {
    buildLease,
    isLeaseValid
};
