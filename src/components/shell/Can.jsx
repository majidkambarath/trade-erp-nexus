import { useOrganisation } from "./OrganisationContext";

// Shows its children only to a person whose role holds the permission (or any one of them, given a list). A courtesy:
// the server refuses the action whatever the screen shows. While the role is not known nothing is hidden.
//
//   <Can permission="sales.approve"><button>Approve</button></Can>
export default function Can({ permission, children, fallback = null }) {
  const { canAny } = useOrganisation();
  return canAny(permission) ? children : fallback;
}
