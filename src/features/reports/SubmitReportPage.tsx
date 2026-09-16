import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { ApiError } from "@/api/errors";
import { RiskScore } from "@/components/app/RiskBadge";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui/primitives";
import { useCurrentEmployeeId, useIsAdmin } from "@/features/auth/useSession";
import { inherentRisk, residualRisk, riskBand } from "@/domain/scoring";
import { RISK_CATEGORIES } from "@/domain/report";
import { EmailTemplatesDialog } from "@/features/admin/EmailTemplatesPage";
import { useEmailReminderTemplates } from "@/features/admin/hooks";

import { EvaluationFields } from "./evaluationFields";
import { evaluationSchema, UNSET_PRIORITY } from "./evaluationSchema";
import { useCreateReport } from "./hooks/queries";

function reportSchema(isAdmin: boolean) {
  return evaluationSchema.extend({
    category: z.enum(RISK_CATEGORIES),
    description: z.string().trim().min(1),
    dueDate: isAdmin ? z.string().min(1) : z.string(),
    owners: isAdmin
      ? z.array(z.object({ email: z.string().trim().email() })).min(1)
      : z.array(z.object({ email: z.string() })),
    sendReminderEmails: z.boolean(),
    reminderTemplateId: z.preprocess(
      (value) => (value === "" || value === null ? null : Number(value)),
      z.number().int().positive().nullable(),
    ),
  });
}

type FormValues = z.input<ReturnType<typeof reportSchema>>;

export function SubmitReportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const employeeId = useCurrentEmployeeId();
  const isAdmin = useIsAdmin();
  const schema = reportSchema(isAdmin);
  const templates = useEmailReminderTemplates({ enabled: isAdmin });
  const createReport = useCreateReport();
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "" as unknown as (typeof RISK_CATEGORIES)[number],
      description: "",
      dueDate: defaultDueDate(),
      owners: [{ email: "@mohins.com" }],
      sendReminderEmails: true,
      reminderTemplateId: null,
      severity: 3,
      frequency: 3,
      controlEffectiveness: 3,
      priority: UNSET_PRIORITY,
      existingMeasures: "",
      proposedMeasures: "",
    },
  });
  const owners = useFieldArray({ control, name: "owners" });

  // Scores are previewed live from the same formulas the server uses, so the reporter can see
  // what their ratings amount to before submitting.
  const severity = Number(watch("severity"));
  const frequency = Number(watch("frequency"));
  const control_ = Number(watch("controlEffectiveness"));
  const inherent = inherentRisk(severity, frequency);
  const residual = residualRisk(severity, frequency, control_);

  function onSubmit(values: FormValues) {
    if (employeeId === null) return;

    const parsed = schema.parse(values);

    createReport.mutate(
      {
        empId: employeeId,
        category: parsed.category,
        description: parsed.description,
        dueDate: new Date(`${parsed.dueDate}T23:59:59`).toISOString(),
        ownerEmails: isAdmin ? parsed.owners.map((owner) => owner.email) : [],
        sendReminderEmails: isAdmin ? parsed.sendReminderEmails : false,
        reminderTemplateId: isAdmin ? parsed.reminderTemplateId : null,
        severity: parsed.severity,
        frequency: parsed.frequency,
        controlEffectiveness: parsed.controlEffectiveness,
        priority: isAdmin ? parsed.priority : UNSET_PRIORITY,
        existingMeasures: parsed.existingMeasures
          ? parsed.existingMeasures
          : null,
        proposedMeasures: parsed.proposedMeasures
          ? parsed.proposedMeasures
          : null,
      },
      { onSuccess: (report) => void navigate(`/reports/${report.id}`) },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-base font-semibold text-ink">
        {t("nav.submitReport")}
      </h1>

      <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>{t("report.title")}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field
              htmlFor="category"
              label={t("report.category")}
              required
              error={errors.category ? t("form.required") : undefined}
            >
              <Select
                id="category"
                aria-required="true"
                aria-invalid={errors.category ? true : undefined}
                {...register("category")}
              >
                <option value="">{t("form.selectPlaceholder")}</option>
                {RISK_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`riskCategory.${category}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              htmlFor="description"
              label={t("report.description")}
              required
              error={errors.description ? t("form.required") : undefined}
            >
              <Textarea
                id="description"
                rows={6}
                aria-required="true"
                aria-invalid={errors.description ? true : undefined}
                {...register("description")}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("report.evaluation")}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <EvaluationFields
              control={control}
              register={register}
              showPriority={isAdmin}
            />

            <div className="flex flex-wrap gap-6 rounded-sm bg-surface-muted px-3 py-2.5">
              <ScorePreview
                label={t("scoring.inherentRisk")}
                hint={t("scoring.inherentRiskHint")}
                score={inherent}
              />
              <ScorePreview
                label={t("scoring.residualRisk")}
                hint={t("scoring.residualRiskHint")}
                score={residual}
              />
            </div>
          </CardBody>
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("report.ownershipAndDueDate")}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field
                htmlFor="dueDate"
                label={t("report.dueDate")}
                hint={t("report.dueDateHint")}
                required
                error={errors.dueDate ? t("form.required") : undefined}
              >
                <Input
                  id="dueDate"
                  type="date"
                  aria-required="true"
                  {...register("dueDate")}
                />
              </Field>

              <div className="space-y-2">
                <p className="text-xs font-medium text-ink-muted">
                  {t("report.riskOwners")}{" "}
                  <span className="text-danger">*</span>
                </p>
                {owners.fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <Input
                      type="email"
                      aria-label={t("report.riskOwnerNumber", {
                        number: index + 1,
                      })}
                      aria-invalid={
                        errors.owners?.[index]?.email ? true : undefined
                      }
                      {...register(`owners.${index}.email`)}
                      onFocus={(event) => {
                        if (event.currentTarget.value === "@mohins.com")
                          event.currentTarget.setSelectionRange(0, 0);
                      }}
                    />
                    {owners.fields.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={t("report.removeOwner")}
                        onClick={() => owners.remove(index)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {errors.owners ? (
                  <p className="text-xs text-danger">
                    {t("report.validOwnerRequired")}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => owners.append({ email: "@mohins.com" })}
                >
                  <Plus className="size-3.5" aria-hidden="true" />{" "}
                  {t("report.addOwner")}
                </Button>
              </div>

              <Field
                htmlFor="reminderTemplateId"
                label={t("emailTemplate.template")}
                optionalLabel={t("form.optional")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    id="reminderTemplateId"
                    className="w-auto min-w-0 flex-1"
                    {...register("reminderTemplateId")}
                  >
                    <option value="">
                      {t("emailTemplate.defaultTemplate")}
                    </option>
                    {templates.data?.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setTemplatesOpen(true)}
                  >
                    {t("emailTemplate.open")}
                  </Button>
                </div>
              </Field>

              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  {...register("sendReminderEmails")}
                />
                {t("report.sendOverdueReminders")}
              </label>
            </CardBody>
          </Card>
        ) : null}

        {createReport.isError ? (
          <p
            className="rounded-sm bg-danger-bg px-3 py-2 text-xs text-danger"
            role="alert"
          >
            {createReport.error instanceof ApiError
              ? (createReport.error.detail ?? t("state.errorTitle"))
              : t("state.errorTitle")}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void navigate("/reports")}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={createReport.isPending || employeeId === null}
          >
            {createReport.isPending ? (
              <>
                <Spinner />
                {t("report.submitting")}
              </>
            ) : (
              t("report.submit")
            )}
          </Button>
        </div>
      </form>

      {templatesOpen ? (
        <EmailTemplatesDialog onClose={() => setTemplatesOpen(false)} />
      ) : null}
    </div>
  );
}

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ScorePreview({
  label,
  hint,
  score,
}: {
  label: string;
  hint: string;
  score: number;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="mt-1">
        <RiskScore score={score} band={riskBand(score)} />
      </div>
      <p className="mt-1 max-w-xs text-xs text-ink-subtle">{hint}</p>
    </div>
  );
}
