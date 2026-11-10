import { required, useTranslate } from "ra-core";
import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";
import { AutocompleteContactInput } from "../contacts/AutocompleteContactInput.tsx";
import { usePackagePicker } from "../axicore/PackagePicker";
import {
  dealPackage,
  INTERESTED_STAGE,
  packageLabel,
  withPackage,
} from "../axicore/packages";

export const DealInputs = () => {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col gap-10 p-1">
      <DealInfoInputs />

      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <DealLinkedToInputs />
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <DealMiscInputs />
      </div>
    </div>
  );
};

const DealInfoInputs = () => {
  return (
    <div className="flex flex-col gap-4 flex-1">
      <TextInput source="name" validate={required()} helperText={false} />
      <TextInput source="description" multiline rows={3} helperText={false} />
    </div>
  );
};

const DealLinkedToInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h6 className="text-lg font-semibold">
        {translate("resources.deals.inputs.linked_to")}
      </h6>
      <ReferenceInput source="company_id" reference="companies">
        <AutocompleteCompanyInput
          label="resources.deals.fields.company_id"
          validate={required()}
          modal
        />
      </ReferenceInput>

      <ReferenceArrayInput source="contact_ids" reference="contacts_summary">
        <AutocompleteContactInput label="resources.deals.fields.contact_ids" />
      </ReferenceArrayInput>
    </div>
  );
};

const DealMiscInputs = () => {
  const { dealStages } = useConfigurationContext();
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h6 className="text-lg font-semibold">
        {translate("resources.deals.field_categories.misc")}
      </h6>

      <NumberInput
        source="amount"
        defaultValue={0}
        helperText={false}
        validate={required()}
      />
      <SelectInput
        source="stage"
        choices={dealStages}
        optionText="label"
        optionValue="value"
        defaultValue="new"
        helperText={false}
        validate={required()}
      />
      <WebsitePackageInput />
    </div>
  );
};

/**
 * Website package (owner, 2026-11-10): when the stage becomes Interested the form asks which website the client
 * wants and keeps it in the deal's categories. AxiCore picks the brochure design from it.
 */
const WebsitePackageInput = () => {
  const { setValue } = useFormContext();
  const stage = useWatch({ name: "stage" }) as string | undefined;
  const categories = useWatch({ name: "categories" }) as string[] | undefined;
  const { ask, dialog } = usePackagePicker();
  const previous = useRef(stage);
  const pkg = dealPackage(categories);

  const choose = async (fallbackStage?: string) => {
    const picked = await ask(pkg);
    if (picked) {
      setValue("categories", withPackage(categories, picked), {
        shouldDirty: true,
      });
    } else if (fallbackStage !== undefined) {
      setValue("stage", fallbackStage, { shouldDirty: true });
    }
  };

  useEffect(() => {
    const was = previous.current;
    previous.current = stage;
    if (stage === INTERESTED_STAGE && was !== INTERESTED_STAGE && !pkg) {
      void choose(was ?? "new");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (stage !== INTERESTED_STAGE && !pkg) return dialog;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      {dialog}
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">Website package</div>
        <div className="truncate text-sm font-medium">
          {pkg ? packageLabel(pkg) : "Not chosen yet"}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => choose()}
      >
        {pkg ? "Change" : "Choose"}
      </Button>
    </div>
  );
};
