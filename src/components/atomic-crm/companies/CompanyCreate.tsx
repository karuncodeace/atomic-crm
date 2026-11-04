import { CanAccess, CreateBase, Form, useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";

import { LeadImportButton } from "../leads/LeadImportButton";
import { CompanyContactsInputs } from "./CompanyContactsInputs";
import { CompanyInputs } from "./CompanyInputs";
import { omitContactSearch } from "./companyForm";

export const CompanyCreate = () => {
  const translate = useTranslate();

  return (
    <CreateBase redirect="show" transform={omitContactSearch}>
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {translate("resources.companies.action.new", {
                  _: "New Company",
                })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {translate("resources.companies.create_hint", {
                  _: "Fill in one lead, or import many from a CSV.",
                })}
              </p>
            </div>
            <CanAccess resource="lead_import" action="create">
              <LeadImportButton size="sm" />
            </CanAccess>
          </div>
          <Form
            defaultValues={{
              // Backend assigns an active BDE; admin must not own the lead.
              sales_id: undefined,
              lead_date: new Date().toLocaleDateString("en-CA"),
              contacts: [],
            }}
          >
            <Card>
              <CardContent className="flex flex-col gap-6">
                <CompanyInputs />
                <Separator />
                <CompanyContactsInputs />
                <div
                  role="toolbar"
                  className="sticky flex pt-4 pb-4 md:pb-0 bottom-0 bg-linear-to-b from-transparent to-card to-10% flex-row justify-end gap-2"
                >
                  <CancelButton />
                  <SaveButton
                    label={translate("resources.companies.action.create", {
                      _: "Create Company",
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
