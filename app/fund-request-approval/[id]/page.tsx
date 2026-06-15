import { redirect } from 'next/navigation';

export default function FundRequestApprovalDetailRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/fund-request/${params.id}?tab=inbox`);
}
