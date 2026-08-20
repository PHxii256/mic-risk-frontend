import { KeyRound, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/api/errors";
import { HeadRow, Row, TableShell, TableSkeleton, Td, Th } from "@/components/app/DataTable";
import { StateBoundary } from "@/components/app/StateBoundary";
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
} from "@/components/ui/primitives";
import type { Employee } from "@/domain/report";
import { useSession } from "@/features/auth/useSession";
import { formatDate } from "@/lib/format";

import {
  useCreateEmployee,
  useDepartments,
  useEmployees,
  useResetEmployeePassword,
  useToggleEmployeeActive,
  useUpdateEmployee,
} from "./hooks";

type Panel =
  { kind: "none" } | { kind: "create" } | { kind: "edit"; employee: Employee } | { kind: "reset"; employee: Employee };

export function EmployeesPage() {
  const { t, i18n } = useTranslation();
  const [panel, setPanel] = useState<Panel>({ kind: "none" });

  const employees = useEmployees();
  const toggle = useToggleEmployeeActive();
  const session = useSession();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-ink">{t("nav.employees")}</h1>
        <Button type="button" onClick={() => setPanel({ kind: "create" })}>
          <Plus className="size-3.5" aria-hidden="true" />
          {t("employee.add")}
        </Button>
      </div>

      {panel.kind === "create" ? <EmployeeForm onClose={() => setPanel({ kind: "none" })} /> : null}
      {panel.kind === "edit" ? (
        <EmployeeForm employee={panel.employee} onClose={() => setPanel({ kind: "none" })} />
      ) : null}
      {panel.kind === "reset" ? (
        <ResetPasswordForm employee={panel.employee} onClose={() => setPanel({ kind: "none" })} />
      ) : null}

      <StateBoundary
        isLoading={employees.isPending}
        error={employees.error}
        data={employees.data}
        onRetry={() => void employees.refetch()}
        skeleton={<TableSkeleton columns={6} />}
        isEmpty={(list) => list.length === 0}
      >
        {(list) => (
          <TableShell>
            <HeadRow>
              <Th>{t("employee.name")}</Th>
              <Th>{t("employee.email")}</Th>
              <Th>{t("employee.department")}</Th>
              <Th>{t("employee.status")}</Th>
              <Th>{t("employee.createdAt")}</Th>
              <Th />
            </HeadRow>
            <tbody>
              {list.map((employee) => (
                <Row key={employee.id}>
                  <Td className="font-medium">{employee.name}</Td>
                  <Td className="text-ink-muted">{employee.email}</Td>
                  <Td className="text-ink-muted">{employee.department.name}</Td>
                  <Td>
                    <span
                      className={
                        employee.active ? "text-xs font-medium text-band-low" : "text-xs font-medium text-ink-subtle"
                      }
                    >
                      {employee.active ? t("employee.active") : t("employee.inactive")}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-muted">{formatDate(employee.createdAt, i18n.language)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPanel({ kind: "edit", employee })}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        {t("common.edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPanel({ kind: "reset", employee })}
                      >
                        <KeyRound className="size-3.5" aria-hidden="true" />
                        {t("employee.resetPassword")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={toggle.isPending}
                        onClick={() => {
                          // Deactivating yourself revokes your own session on the next request.
                          const isSelf = employee.identityUserId === session?.employee.identityUserId;
                          if (isSelf && employee.active && !confirm(t("employee.confirmSelfDeactivate"))) return;
                          toggle.mutate(employee.id);
                        }}
                      >
                        {employee.active ? t("employee.deactivate") : t("employee.activate")}
                      </Button>
                    </div>
                  </Td>
                </Row>
              ))}
            </tbody>
          </TableShell>
        )}
      </StateBoundary>
    </div>
  );
}

function EmployeeForm({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const { t } = useTranslation();
  const departments = useDepartments();
  const create = useCreateEmployee();
  const update = useUpdateEmployee();

  const [name, setName] = useState(employee?.name ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [deptId, setDeptId] = useState(String(employee?.department.id ?? ""));
  const [role, setRole] = useState("User");
  const [active, setActive] = useState(employee?.active ?? true);

  const mutation = employee ? update : create;
  const isEditing = employee !== undefined;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!deptId) return;

    if (isEditing) {
      update.mutate({ id: employee.id, name, deptId: Number(deptId), active }, { onSuccess: onClose });
    } else {
      create.mutate(
        { email, name, deptId: Number(deptId), role },
        { onSuccess: onClose },
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? t("employee.edit") : t("employee.add")}</CardTitle>
      </CardHeader>
      <CardBody>
        <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}>
          <Field htmlFor="emp-name" label={t("employee.name")} required>
            <Input id="emp-name" value={name} aria-required="true" onChange={(e) => setName(e.currentTarget.value)} />
          </Field>

          {!isEditing ? (
            <>
              <Field htmlFor="emp-email" label={t("employee.email")} required>
                <Input
                  id="emp-email"
                  type="email"
                  value={email}
                  aria-required="true"
                  onChange={(e) => setEmail(e.currentTarget.value)}
                />
              </Field>
              <Field htmlFor="emp-role" label={t("employee.role")} required>
                <Select id="emp-role" value={role} onChange={(e) => setRole(e.currentTarget.value)}>
                  <option value="User">{t("role.User")}</option>
                  <option value="Admin">{t("role.Admin")}</option>
                </Select>
              </Field>
            </>
          ) : null}

          <Field htmlFor="emp-dept" label={t("employee.department")} required>
            <Select
              id="emp-dept"
              value={deptId}
              aria-required="true"
              onChange={(e) => setDeptId(e.currentTarget.value)}
            >
              <option value="">{t("form.selectPlaceholder")}</option>
              {departments.data?.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} — {dept.branchLocation}
                </option>
              ))}
            </Select>
          </Field>

          {isEditing ? (
            <Field htmlFor="emp-active" label={t("employee.status")}>
              <Select
                id="emp-active"
                value={active ? "true" : "false"}
                onChange={(e) => setActive(e.currentTarget.value === "true")}
              >
                <option value="true">{t("employee.active")}</option>
                <option value="false">{t("employee.inactive")}</option>
              </Select>
            </Field>
          ) : null}

          {mutation.isError ? (
            <p className="sm:col-span-2 rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger" role="alert">
              {mutation.error instanceof ApiError
                ? (mutation.error.detail ?? t("state.errorTitle"))
                : t("state.errorTitle")}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {t("common.save")}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ResetPasswordForm({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { t } = useTranslation();
  const reset = useResetEmployeePassword();
  const [password, setPassword] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("employee.resetPassword")} — {employee.name}
        </CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="flex flex-wrap items-end gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            reset.mutate({ id: employee.id, newPassword: password }, { onSuccess: onClose });
          }}
        >
          <div className="min-w-56 flex-1">
            <Field htmlFor="reset-password" label={t("account.newPassword")} hint={t("employee.resetHint")} required>
              <Input
                id="reset-password"
                type="password"
                value={password}
                autoComplete="new-password"
                aria-required="true"
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
            </Field>
          </div>

          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={reset.isPending}>
            {reset.isPending ? <Spinner /> : null}
            {t("employee.resetPassword")}
          </Button>

          {reset.isError ? (
            <p className="w-full rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger" role="alert">
              {reset.error instanceof ApiError
                ? reset.error.fieldErrors
                  ? Object.values(reset.error.fieldErrors).flat().join(" ")
                  : (reset.error.detail ?? t("state.errorTitle"))
                : t("state.errorTitle")}
            </p>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
