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
export declare type MasterclassOneFormCreateFormInputValues = {
    full_name?: string;
    email?: string;
    trading_experience?: string;
    trading_skill?: string;
    description?: string;
    additional?: string;
};
export declare type MasterclassOneFormCreateFormValidationValues = {
    full_name?: ValidationFunction<string>;
    email?: ValidationFunction<string>;
    trading_experience?: ValidationFunction<string>;
    trading_skill?: ValidationFunction<string>;
    description?: ValidationFunction<string>;
    additional?: ValidationFunction<string>;
};
export declare type PrimitiveOverrideProps<T> = Partial<T> & React.DOMAttributes<HTMLDivElement>;
export declare type MasterclassOneFormCreateFormOverridesProps = {
    MasterclassOneFormCreateFormGrid?: PrimitiveOverrideProps<GridProps>;
    full_name?: PrimitiveOverrideProps<TextFieldProps>;
    email?: PrimitiveOverrideProps<TextFieldProps>;
    trading_experience?: PrimitiveOverrideProps<TextFieldProps>;
    trading_skill?: PrimitiveOverrideProps<TextFieldProps>;
    description?: PrimitiveOverrideProps<TextFieldProps>;
    additional?: PrimitiveOverrideProps<TextFieldProps>;
} & EscapeHatchProps;
export declare type MasterclassOneFormCreateFormProps = React.PropsWithChildren<{
    overrides?: MasterclassOneFormCreateFormOverridesProps | undefined | null;
} & {
    clearOnSuccess?: boolean;
    onSubmit?: (fields: MasterclassOneFormCreateFormInputValues) => MasterclassOneFormCreateFormInputValues;
    onSuccess?: (fields: MasterclassOneFormCreateFormInputValues) => void;
    onError?: (fields: MasterclassOneFormCreateFormInputValues, errorMessage: string) => void;
    onChange?: (fields: MasterclassOneFormCreateFormInputValues) => MasterclassOneFormCreateFormInputValues;
    onValidate?: MasterclassOneFormCreateFormValidationValues;
} & React.CSSProperties>;
export default function MasterclassOneFormCreateForm(props: MasterclassOneFormCreateFormProps): React.ReactElement;
