import { useOrganizationList, useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';

function OrganizationSelector() {
  const { isLoaded, setActive, createOrganization, organizationList } = useOrganizationList();
  const { user } = useUser();

  useEffect(() => {
    // If there's only one organization, select it automatically
    if (isLoaded && organizationList?.length === 1) {
      setActive({ organization: organizationList[0].organization.id });
    }
  }, [isLoaded, organizationList, setActive]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const handleCreateOrg = async () => {
    try {
      const org = await createOrganization({ name: `${user?.firstName || 'My'}'s Organization` });
      await setActive({ organization: org.id });
    } catch (error) {
      console.error('Failed to create organization:', error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
          Select an Organization
        </h2>

        {!isLoaded && (
          <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
            Loading...
          </div>
        )}
        {organizationList?.length === 0 && isLoaded && (
          <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
            You don&apos;t have access to any organizations.
          </div>
        )}

        {organizationList?.length === 0 ? (
          <div className="text-center">
            <p className="mb-4 text-gray-600">You don&apos;t have any organizations yet.</p>
            <button
              onClick={handleCreateOrg}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create Organization
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {organizationList?.map((org) => (
              <button
                key={org.organization.id}
                onClick={() => setActive({ organization: org.organization.id })}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
              >
                <div className="flex items-center">
                  {org.organization.imageUrl ? (
                    <img
                      src={org.organization.imageUrl}
                      alt={org.organization.name}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                      {org.organization.name[0]}
                    </div>
                  )}
                  <span className="ml-3 font-medium text-gray-900">{org.organization.name}</span>
                </div>
                <span className="text-sm text-gray-500">{org.membership.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrganizationSelector;
