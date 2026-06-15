import { redirect } from 'next/navigation';

export default function FundRequestApprovalRedirectPage() {
  redirect('/fund-request?tab=inbox');
}
