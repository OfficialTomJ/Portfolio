/***************************************************************************
 * The contents of this file were generated with Amplify Studio.           *
 * Please refrain from making any modifications to this file.              *
 * Any changes to this file will be overwritten when running amplify pull. *
 **************************************************************************/

import * as React from "react";
import { GridProps, TextFieldProps } from "@aws-amplify/ui-react";
export declare type EscapeHatchProps = {
    [elementHierarchy: string]: Record<string, unknown>;
} | null;
export declare type VariantValues = {
    [key: string]: string;
};
export declare type Variant = {
    variantValues: VariantValues;
    overrides: EscapeHatchProps;
};
export declare type ValidationResponse = {
    hasError: boolean;
    errorMessage?: string;
};
export declare type ValidationFunction<T> = (value: T, validationResponse: ValidationResponse) => ValidationResponse | Promise<ValidationResponse>;
export declare type MasterclassOneFormUpdateFormInputValues = {
    full_name?: string;
    email?: string;
    trading_experience?: string;
    trading_skill?: string;
    description?: string;
    additional?: string;
};
export declare type MasterclassOneFormUpdateFormValidationValues = {
    full_name?: ValidationFunction<string>;
    email?: ValidationFunction<string>;
    trading_experience?: ValidationFunction<string>;
    trading_skill?: ValidationFunction<string>;
    description?: ValidationFunction<string>;
    additional?: ValidationFunction<string>;
};
export declare type PrimitiveOverrideProps<T> = Partial<T> & React.DOMAttributes<HTMLDivElement>;
export declare type MasterclassOneFormUpdateFormOverridesProps = {
    MasterclassOneFormUpdateFormGrid?: PrimitiveOverrideProps<GridProps>;
    full_name?: PrimitiveOverrideProps<TextFieldProps>;
    email?: PrimitiveOverrideProps<TextFieldProps>;
    trading_experience?: PrimitiveOverrideProps<TextFieldProps>;
    trading_skill?: PrimitiveOverrideProps<TextFieldProps>;
    description?: PrimitiveOverrideProps<TextFieldProps>;
    additional?: PrimitiveOverrideProps<TextFieldProps>;
} & EscapeHatchProps;
export declare type MasterclassOneFormUpdateFormProps = React.PropsWithChildren<{
    overrides?: MasterclassOneFormUpdateFormOverridesProps | undefined | null;
} & {
    id?: string;
    masterclassOneForm?: any;
    onSubmit?: (fields: MasterclassOneFormUpdateFormInputValues) => MasterclassOneFormUpdateFormInputValues;
    onSuccess?: (fields: MasterclassOneFormUpdateFormInputValues) => void;
    onError?: (fields: MasterclassOneFormUpdateFormInputValues, errorMessage: string) => void;
    onChange?: (fields: MasterclassOneFormUpdateFormInputValues) => MasterclassOneFormUpdateFormInputValues;
    onValidate?: MasterclassOneFormUpdateFormValidationValues;
} & React.CSSProperties>;
export default function MasterclassOneFormUpdateForm(props: MasterclassOneFormUpdateFormProps): React.ReactElement;