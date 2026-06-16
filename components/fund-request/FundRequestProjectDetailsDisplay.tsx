import {
  FUND_REQUEST_FIELD_LABELS,
  formatFundRequestPercentage,
} from "@/types/fund-request";
import {
  formatFundRequestPoAmount,
  fundRequestUsesPerProjectPo,
  parseFundRequestProjectDetails,
  type FundRequestProjectDetail,
} from "@/lib/fund-request-project-details";
import type { FundRequestRow } from "@/types/fund-request";
import { FundRequestField } from "@/components/fund-request/FundRequestField";
import { cn } from "@/lib/utils";

type FundRequestProjectDetailsDisplayProps = {
  request: Pick<
    FundRequestRow,
    | "project_details"
    | "project_title"
    | "project_location"
    | "current_project_percentage"
    | "po_number"
    | "po_amount"
    | "subcontractor_progress_completion_percentage"
  >;
  showTopLevelPo?: boolean;
  vendorName?: string;
  showSubcontractorFields?: boolean;
};

const tableShellClass = "overflow-x-auto rounded-md border border-border/80";
const tableClass = "w-full min-w-[720px] border-collapse text-sm";
const headCellClass =
  "border-b border-border/80 bg-muted/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const bodyCellClass =
  "border-b border-border/60 px-3 py-3 align-top text-sm leading-snug last:border-b-0";

function resolveDisplayPoNumber(
  request: FundRequestProjectDetailsDisplayProps["request"],
  project: FundRequestProjectDetail,
  perProjectPo: boolean,
  showTopLevelPo: boolean
): string | null {
  if (perProjectPo && project.po_number?.trim()) {
    return project.po_number;
  }
  if (!perProjectPo && showTopLevelPo && request.po_number?.trim()) {
    return request.po_number;
  }
  return project.po_number?.trim() || request.po_number?.trim() || null;
}

function multiProjectFieldLabel(label: string, index: number): string {
  return `${label} ${index + 1}`;
}

function ProjectReferenceTable({
  project,
  poNumber,
}: {
  project: FundRequestProjectDetail;
  poNumber: string | null;
}) {
  return (
    <div className={tableShellClass}>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={headCellClass}>{FUND_REQUEST_FIELD_LABELS.poNumber}</th>
            <th className={headCellClass}>{FUND_REQUEST_FIELD_LABELS.projectTitle}</th>
            <th className={headCellClass}>{FUND_REQUEST_FIELD_LABELS.projectLocation}</th>
            <th className={cn(headCellClass, "whitespace-nowrap")}>
              {FUND_REQUEST_FIELD_LABELS.poAmount}
            </th>
            <th className={cn(headCellClass, "whitespace-nowrap")}>
              {FUND_REQUEST_FIELD_LABELS.projectCompletion}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={cn(bodyCellClass, "uppercase")}>{poNumber || "—"}</td>
            <td className={cn(bodyCellClass, "uppercase")}>{project.title || "—"}</td>
            <td className={cn(bodyCellClass, "uppercase")}>
              {project.location || "—"}
            </td>
            <td className={bodyCellClass}>
              {formatFundRequestPoAmount(project.po_amount)}
            </td>
            <td className={bodyCellClass}>
              {formatFundRequestPercentage(project.completion_percentage)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MultiProjectFields({
  projects,
  request,
  perProjectPo,
  showTopLevelPo,
}: {
  projects: FundRequestProjectDetail[];
  request: FundRequestProjectDetailsDisplayProps["request"];
  perProjectPo: boolean;
  showTopLevelPo: boolean;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Project Details
      </h4>
      <div className="space-y-2">
        {projects.map((project, index) => {
          const poNumber = resolveDisplayPoNumber(
            request,
            project,
            perProjectPo,
            showTopLevelPo
          );

          return (
            <div
              key={`${project.title}-${index}`}
              className="grid grid-cols-1 gap-3 rounded-md border border-dashed p-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {poNumber ? (
                <FundRequestField
                  label={multiProjectFieldLabel(FUND_REQUEST_FIELD_LABELS.poNumber, index)}
                  value={poNumber}
                />
              ) : null}
              <FundRequestField
                label={multiProjectFieldLabel(
                  FUND_REQUEST_FIELD_LABELS.projectTitle,
                  index
                )}
                value={project.title || "—"}
              />
              <FundRequestField
                label={multiProjectFieldLabel(
                  FUND_REQUEST_FIELD_LABELS.projectLocation,
                  index
                )}
                value={project.location || "—"}
              />
              <FundRequestField
                label={multiProjectFieldLabel(
                  FUND_REQUEST_FIELD_LABELS.projectCompletion,
                  index
                )}
                value={formatFundRequestPercentage(project.completion_percentage)}
                uppercaseValue={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubcontractorReferenceTable({
  vendorName,
  subcontractorProgress,
}: {
  vendorName?: string;
  subcontractorProgress: number | string | null | undefined;
}) {
  return (
    <div className={tableShellClass}>
      <table className={cn(tableClass, "min-w-[480px]")}>
        <thead>
          <tr>
            <th className={headCellClass}>
              {FUND_REQUEST_FIELD_LABELS.subcontractorName}
            </th>
            <th className={cn(headCellClass, "whitespace-nowrap")}>
              {FUND_REQUEST_FIELD_LABELS.subcontractorProgress}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={cn(bodyCellClass, "uppercase")}>{vendorName || "—"}</td>
            <td className={bodyCellClass}>
              {formatFundRequestPercentage(subcontractorProgress)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function FundRequestProjectDetailsDisplay({
  request,
  showTopLevelPo = true,
  vendorName,
  showSubcontractorFields = false,
}: FundRequestProjectDetailsDisplayProps) {
  const projects = parseFundRequestProjectDetails(request);
  const perProjectPo = fundRequestUsesPerProjectPo(request);

  if (projects.length === 0) {
    return null;
  }

  if (projects.length === 1) {
    const project = projects[0];
    const poNumber = resolveDisplayPoNumber(
      request,
      project,
      perProjectPo,
      showTopLevelPo
    );

    return (
      <div className="space-y-4">
        <ProjectReferenceTable project={project} poNumber={poNumber} />
        {showSubcontractorFields ? (
          <SubcontractorReferenceTable
            vendorName={vendorName}
            subcontractorProgress={request.subcontractor_progress_completion_percentage}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MultiProjectFields
        projects={projects}
        request={request}
        perProjectPo={perProjectPo}
        showTopLevelPo={showTopLevelPo}
      />
      {showSubcontractorFields ? (
        <SubcontractorReferenceTable
          vendorName={vendorName}
          subcontractorProgress={request.subcontractor_progress_completion_percentage}
        />
      ) : null}
    </div>
  );
}

export function shouldShowTopLevelFundRequestPo(
  request: Pick<FundRequestRow, "project_details" | "po_number">
): boolean {
  return !fundRequestUsesPerProjectPo(request);
}
