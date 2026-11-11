import { useOrganisation } from "./OrganisationContext";

// Shows its children only to a person whose role holds the permission (or any one of them, given a list). A courtesy:
// the server refuses the action whatever the screen shows. While the role is not known nothing is hidden.
//
//   <Can permission="sales.approve"><button>Approve</button></Can>
//
// `feature` is the other half of the same question: an action the organisation's PLAN does not include is not an
// action, whoever the person is. Both must say yes, and both fail open while nothing is known (lib/organisation.js
// mayUse). Use it for the action itself - never to hide a record of something that already happened.
//
//   <Can permission="sales.send" feature="messaging"><button>Send</button></Can>
export default function Can({ permission, feature, children, fallback = null }) {
  const { canAny, featureOn } = useOrganisation();
  if (feature && !featureOn(feature)) return fallback;
  return canAny(permission) ? children : fallback;
}
