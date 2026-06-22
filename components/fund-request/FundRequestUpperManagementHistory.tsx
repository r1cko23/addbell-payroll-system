import { FundRequestCutoffHistory } from "./FundRequestCutoffHistory";

type FundRequestUpperManagementHistoryProps = {
  detailHrefBase: string;
};

export function FundRequestUpperManagementHistory({
  detailHrefBase,
}: FundRequestUpperManagementHistoryProps) {
  return <FundRequestCutoffHistory detailHrefBase={detailHrefBase} role="upper_management" />;
}
