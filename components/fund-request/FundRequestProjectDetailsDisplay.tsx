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
import { SubcontractorInvoiceTrackingDisplay } from "@/components/fund-request/SubcontractorInvoiceTrackingDisplay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    | "subcontractor_po_amount"
  >;
  showTopLevelPo?: boolean;
  vendorName?: string;
  showSubcontractorFields?: boolean;
  showSubcontractorPoAmount?: boolean;
  editableSubcontractorPoAmount?: boolean;
  subcontractorPoAmountInput?: string;
  onSubcontractorPoAmountInputChange?: (value: string) => void;
  showSubcontractorInvoiceTracking?: boolean;
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

function ProjectReferenceCard({
  project,
  poNumber,
}: {
  project: FundRequestProjectDetail;
  poNumber: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-border/80 p-3 sm:grid-cols-2">
      {poNumber ? (
        <FundRequestField
          label={FUND_REQUEST_FIELD_LABELS.poNumber}
          value={poNumber}
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
        label={FUND_REQUEST_FIELD_LABELS.poAmount}
        value={formatFundRequestPoAmount(project.po_amount)}
        uppercaseValue={false}
      />
      <FundRequestField
        label={FUND_REQUEST_FIELD_LABELS.projectCompletion}
        value={formatFundRequestPercentage(project.completion_percentage)}
        uppercaseValue={false}
      />
    </div>
  );
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

function SubcontractorReferenceCard({
  vendorName,
  subcontractorProgress,
  subcontractorPoAmount,
  showSubcontractorPoAmount = false,
  editableSubcontractorPoAmount = false,
  subcontractorPoAmountInput = "",
  onSubcontractorPoAmountInputChange,
}: {
  vendorName?: string;
  subcontractorProgress: number | string | null | undefined;
  subcontractorPoAmount?: number | null;
  showSubcontractorPoAmount?: boolean;
  editableSubcontractorPoAmount?: boolean;
  subcontractorPoAmountInput?: string;
  onSubcontractorPoAmountInputChange?: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-border/80 p-3">
      <FundRequestField
        label={FUND_REQUEST_FIELD_LABELS.subcontractorName}
        value={vendorName || "—"}
      />
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          showSubcontractorPoAmount ? "sm:grid-cols-2" : "sm:grid-cols-1"
        )}
      >
        <FundRequestField
          label={FUND_REQUEST_FIELD_LABELS.subcontractorProgress}
          value={formatFundRequestPercentage(subcontractorProgress)}
          uppercaseValue={false}
        />
        {showSubcontractorPoAmount ? (
          editableSubcontractorPoAmount ? (
            <div className="space-y-1.5">
              <Label
                htmlFor="subcontractor_po_amount_display"
                required
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {FUND_REQUEST_FIELD_LABELS.subcontractorPoAmount}
              </Label>
              <Input
                id="subcontractor_po_amount_display"
                type="text"
                inputMode="decimal"
                value={subcontractorPoAmountInput}
                onChange={(e) => onSubcontractorPoAmountInputChange?.(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          ) : (
            <FundRequestField
              label={FUND_REQUEST_FIELD_LABELS.subcontractorPoAmount}
              value={formatFundRequestPoAmount(subcontractorPoAmount)}
              uppercaseValue={false}
            />
          )
        ) : null}
      </div>
    </div>
  );
}

function SubcontractorReferenceTable({
  vendorName,
  subcontractorProgress,
  subcontractorPoAmount,
  showSubcontractorPoAmount = false,
  editableSubcontractorPoAmount = false,
  subcontractorPoAmountInput = "",
  onSubcontractorPoAmountInputChange,
}: {
  vendorName?: string;
  subcontractorProgress: number | string | null | undefined;
  subcontractorPoAmount?: number | null;
  showSubcontractorPoAmount?: boolean;
  editableSubcontractorPoAmount?: boolean;
  subcontractorPoAmountInput?: string;
  onSubcontractorPoAmountInputChange?: (value: string) => void;
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
            {showSubcontractorPoAmount ? (
              <th className={cn(headCellClass, "whitespace-nowrap")}>
                {FUND_REQUEST_FIELD_LABELS.subcontractorPoAmount}
                {editableSubcontractorPoAmount ? (
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                ) : null}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={cn(bodyCellClass, "uppercase")}>{vendorName || "—"}</td>
            <td className={bodyCellClass}>
              {formatFundRequestPercentage(subcontractorProgress)}
            </td>
            {showSubcontractorPoAmount ? (
              <td className={bodyCellClass}>
                {editableSubcontractorPoAmount ? (
                  <Input
                    id="subcontractor_po_amount_table"
                    type="text"
                    inputMode="decimal"
                    value={subcontractorPoAmountInput}
                    onChange={(e) => onSubcontractorPoAmountInputChange?.(e.target.value)}
                    placeholder="0.00"
                    required
                    className="min-w-[10rem]"
                  />
                ) : (
                  formatFundRequestPoAmount(subcontractorPoAmount)
                )}
              </td>
            ) : null}
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
  showSubcontractorPoAmount = false,
  editableSubcontractorPoAmount = false,
  subcontractorPoAmountInput = "",
  onSubcontractorPoAmountInputChange,
  showSubcontractorInvoiceTracking = false,
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
        <div className="hidden md:block">
          <ProjectReferenceTable project={project} poNumber={poNumber} />
        </div>
        <div className="md:hidden">
          <ProjectReferenceCard project={project} poNumber={poNumber} />
        </div>
        {showSubcontractorFields ? (
          <>
            <div className="hidden md:block">
              <SubcontractorReferenceTable
                vendorName={vendorName}
                subcontractorProgress={request.subcontractor_progress_completion_percentage}
                subcontractorPoAmount={request.subcontractor_po_amount}
                showSubcontractorPoAmount={showSubcontractorPoAmount}
                editableSubcontractorPoAmount={editableSubcontractorPoAmount}
                subcontractorPoAmountInput={subcontractorPoAmountInput}
                onSubcontractorPoAmountInputChange={onSubcontractorPoAmountInputChange}
              />
            </div>
            <div className="md:hidden">
              <SubcontractorReferenceCard
                vendorName={vendorName}
                subcontractorProgress={request.subcontractor_progress_completion_percentage}
                subcontractorPoAmount={request.subcontractor_po_amount}
                showSubcontractorPoAmount={showSubcontractorPoAmount}
                editableSubcontractorPoAmount={editableSubcontractorPoAmount}
                subcontractorPoAmountInput={subcontractorPoAmountInput}
                onSubcontractorPoAmountInputChange={onSubcontractorPoAmountInputChange}
              />
            </div>
          </>
        ) : null}
        {showSubcontractorInvoiceTracking ? (
          <SubcontractorInvoiceTrackingDisplay
            projectDetails={request.project_details}
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
        <>
          <div className="hidden md:block">
            <SubcontractorReferenceTable
              vendorName={vendorName}
              subcontractorProgress={request.subcontractor_progress_completion_percentage}
              subcontractorPoAmount={request.subcontractor_po_amount}
              showSubcontractorPoAmount={showSubcontractorPoAmount}
              editableSubcontractorPoAmount={editableSubcontractorPoAmount}
              subcontractorPoAmountInput={subcontractorPoAmountInput}
              onSubcontractorPoAmountInputChange={onSubcontractorPoAmountInputChange}
            />
          </div>
          <div className="md:hidden">
            <SubcontractorReferenceCard
              vendorName={vendorName}
              subcontractorProgress={request.subcontractor_progress_completion_percentage}
              subcontractorPoAmount={request.subcontractor_po_amount}
              showSubcontractorPoAmount={showSubcontractorPoAmount}
              editableSubcontractorPoAmount={editableSubcontractorPoAmount}
              subcontractorPoAmountInput={subcontractorPoAmountInput}
              onSubcontractorPoAmountInputChange={onSubcontractorPoAmountInputChange}
            />
          </div>
        </>
      ) : null}
      {showSubcontractorInvoiceTracking ? (
        <SubcontractorInvoiceTrackingDisplay
          projectDetails={request.project_details}
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
