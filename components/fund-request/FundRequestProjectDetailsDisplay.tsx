import {
  FUND_REQUEST_FIELD_LABELS,
  formatFundRequestPercentage,
} from "@/types/fund-request";
import {
  fundRequestUsesPerProjectPo,
  parseFundRequestProjectDetails,
  type FundRequestProjectDetail,
} from "@/lib/fund-request-project-details";
import type { FundRequestRow } from "@/types/fund-request";
import { FundRequestField } from "@/components/fund-request/FundRequestField";

type FundRequestProjectDetailsDisplayProps = {
  request: Pick<
    FundRequestRow,
    | "project_details"
    | "project_title"
    | "project_location"
    | "current_project_percentage"
    | "po_number"
  >;
  showTopLevelPo?: boolean;
};

function SingleProjectFields({
  project,
  showPo,
}: {
  project: FundRequestProjectDetail;
  showPo: boolean;
}) {
  return (
    <>
      {showPo && project.po_number ? (
        <FundRequestField
          label={FUND_REQUEST_FIELD_LABELS.poNumber}
          value={project.po_number}
        />
      ) : null}
      <FundRequestField
        label={FUND_REQUEST_FIELD_LABELS.projectTitle}
        value={project.title || "—"}
      />
      <FundRequestField
        label={FUND_REQUEST_FIELD_LABELS.projectLocation}
        value={project.location || "—"}
      />
      <FundRequestField
        label={FUND_REQUEST_FIELD_LABELS.projectCompletion}
        value={formatFundRequestPercentage(project.completion_percentage)}
      />
    </>
  );
}

export function FundRequestProjectDetailsDisplay({
  request,
  showTopLevelPo = true,
}: FundRequestProjectDetailsDisplayProps) {
  const projects = parseFundRequestProjectDetails(request);
  const perProjectPo = fundRequestUsesPerProjectPo(request);

  if (projects.length === 0) {
    return null;
  }

  if (projects.length === 1) {
    return (
      <SingleProjectFields
        project={projects[0]}
        showPo={!showTopLevelPo || perProjectPo}
      />
    );
  }

  return (
    <div className="sm:col-span-2 space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Project Details
      </h4>
      <div className="space-y-2">
        {projects.map((project, index) => (
          <div
            key={`${project.title}-${index}`}
            className="grid grid-cols-1 gap-3 rounded-md border border-dashed p-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {project.po_number ? (
              <FundRequestField
                label={`${FUND_REQUEST_FIELD_LABELS.poNumber} ${index + 1}`}
                value={project.po_number}
              />
            ) : null}
            <FundRequestField
              label={`${FUND_REQUEST_FIELD_LABELS.projectTitle} ${index + 1}`}
              value={project.title || "—"}
            />
            <FundRequestField
              label={`${FUND_REQUEST_FIELD_LABELS.projectLocation} ${index + 1}`}
              value={project.location || "—"}
            />
            <FundRequestField
              label={`${FUND_REQUEST_FIELD_LABELS.projectCompletion} ${index + 1}`}
              value={formatFundRequestPercentage(project.completion_percentage)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function shouldShowTopLevelFundRequestPo(
  request: Pick<FundRequestRow, "project_details" | "po_number">
): boolean {
  return !fundRequestUsesPerProjectPo(request);
}
