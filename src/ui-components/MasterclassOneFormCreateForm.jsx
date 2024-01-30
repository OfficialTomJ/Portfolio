/***************************************************************************
 * The contents of this file were generated with Amplify Studio.           *
 * Please refrain from making any modifications to this file.              *
 * Any changes to this file will be overwritten when running amplify pull. *
 **************************************************************************/

/* eslint-disable */
import * as React from "react";
import { Button, Flex, Grid, TextField } from "@aws-amplify/ui-react";
import { fetchByPath, getOverrideProps, validateField } from "./utils";
import { generateClient } from "aws-amplify/api";
import { createMasterclassOneForm } from "../graphql/mutations";
const client = generateClient();
export default function MasterclassOneFormCreateForm(props) {
  const {
    clearOnSuccess = true,
    onSuccess,
    onError,
    onSubmit,
    onValidate,
    onChange,
    overrides,
    ...rest
  } = props;
  const initialValues = {
    full_name: "",
    email: "",
    trading_experience: "",
    trading_skill: "",
    description: "",
    additional: "",
  };
  const [full_name, setFull_name] = React.useState(initialValues.full_name);
  const [email, setEmail] = React.useState(initialValues.email);
  const [trading_experience, setTrading_experience] = React.useState(
    initialValues.trading_experience
  );
  const [trading_skill, setTrading_skill] = React.useState(
    initialValues.trading_skill
  );
  const [description, setDescription] = React.useState(
    initialValues.description
  );
  const [additional, setAdditional] = React.useState(initialValues.additional);
  const [errors, setErrors] = React.useState({});
  const resetStateValues = () => {
    setFull_name(initialValues.full_name);
    setEmail(initialValues.email);
    setTrading_experience(initialValues.trading_experience);
    setTrading_skill(initialValues.trading_skill);
    setDescription(initialValues.description);
    setAdditional(initialValues.additional);
    setErrors({});
  };
  const validations = {
    full_name: [],
    email: [],
    trading_experience: [],
    trading_skill: [],
    description: [],
    additional: [],
  };
  const runValidationTasks = async (
    fieldName,
    currentValue,
    getDisplayValue
  ) => {
    const value =
      currentValue && getDisplayValue
        ? getDisplayValue(currentValue)
        : currentValue;
    let validationResponse = validateField(value, validations[fieldName]);
    const customValidator = fetchByPath(onValidate, fieldName);
    if (customValidator) {
      validationResponse = await customValidator(value, validationResponse);
    }
    setErrors((errors) => ({ ...errors, [fieldName]: validationResponse }));
    return validationResponse;
  };
  return (
    <Grid
      as="form"
      rowGap="15px"
      columnGap="15px"
      padding="20px"
      onSubmit={async (event) => {
        event.preventDefault();
        let modelFields = {
          full_name,
          email,
          trading_experience,
          trading_skill,
          description,
          additional,
        };
        const validationResponses = await Promise.all(
          Object.keys(validations).reduce((promises, fieldName) => {
            if (Array.isArray(modelFields[fieldName])) {
              promises.push(
                ...modelFields[fieldName].map((item) =>
                  runValidationTasks(fieldName, item)
                )
              );
              return promises;
            }
            promises.push(
              runValidationTasks(fieldName, modelFields[fieldName])
            );
            return promises;
          }, [])
        );
        if (validationResponses.some((r) => r.hasError)) {
          return;
        }
        if (onSubmit) {
          modelFields = onSubmit(modelFields);
        }
        try {
          Object.entries(modelFields).forEach(([key, value]) => {
            if (typeof value === "string" && value === "") {
              modelFields[key] = null;
            }
          });
          await client.graphql({
            query: createMasterclassOneForm.replaceAll("__typename", ""),
            variables: {
              input: {
                ...modelFields,
              },
            },
          });
          if (onSuccess) {
            onSuccess(modelFields);
          }
          if (clearOnSuccess) {
            resetStateValues();
          }
        } catch (err) {
          if (onError) {
            const messages = err.errors.map((e) => e.message).join("\n");
            onError(modelFields, messages);
          }
        }
      }}
      {...getOverrideProps(overrides, "MasterclassOneFormCreateForm")}
      {...rest}
    >
      <TextField
        label="Full name"
        isRequired={false}
        isReadOnly={false}
        value={full_name}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              full_name: value,
              email,
              trading_experience,
              trading_skill,
              description,
              additional,
            };
            const result = onChange(modelFields);
            value = result?.full_name ?? value;
          }
          if (errors.full_name?.hasError) {
            runValidationTasks("full_name", value);
          }
          setFull_name(value);
        }}
        onBlur={() => runValidationTasks("full_name", full_name)}
        errorMessage={errors.full_name?.errorMessage}
        hasError={errors.full_name?.hasError}
        {...getOverrideProps(overrides, "full_name")}
      ></TextField>
      <TextField
        label="Email"
        isRequired={false}
        isReadOnly={false}
        value={email}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              full_name,
              email: value,
              trading_experience,
              trading_skill,
              description,
              additional,
            };
            const result = onChange(modelFields);
            value = result?.email ?? value;
          }
          if (errors.email?.hasError) {
            runValidationTasks("email", value);
          }
          setEmail(value);
        }}
        onBlur={() => runValidationTasks("email", email)}
        errorMessage={errors.email?.errorMessage}
        hasError={errors.email?.hasError}
        {...getOverrideProps(overrides, "email")}
      ></TextField>
      <TextField
        label="Trading experience"
        isRequired={false}
        isReadOnly={false}
        value={trading_experience}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              full_name,
              email,
              trading_experience: value,
              trading_skill,
              description,
              additional,
            };
            const result = onChange(modelFields);
            value = result?.trading_experience ?? value;
          }
          if (errors.trading_experience?.hasError) {
            runValidationTasks("trading_experience", value);
          }
          setTrading_experience(value);
        }}
        onBlur={() =>
          runValidationTasks("trading_experience", trading_experience)
        }
        errorMessage={errors.trading_experience?.errorMessage}
        hasError={errors.trading_experience?.hasError}
        {...getOverrideProps(overrides, "trading_experience")}
      ></TextField>
      <TextField
        label="Trading skill"
        isRequired={false}
        isReadOnly={false}
        value={trading_skill}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              full_name,
              email,
              trading_experience,
              trading_skill: value,
              description,
              additional,
            };
            const result = onChange(modelFields);
            value = result?.trading_skill ?? value;
          }
          if (errors.trading_skill?.hasError) {
            runValidationTasks("trading_skill", value);
          }
          setTrading_skill(value);
        }}
        onBlur={() => runValidationTasks("trading_skill", trading_skill)}
        errorMessage={errors.trading_skill?.errorMessage}
        hasError={errors.trading_skill?.hasError}
        {...getOverrideProps(overrides, "trading_skill")}
      ></TextField>
      <TextField
        label="Description"
        isRequired={false}
        isReadOnly={false}
        value={description}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              full_name,
              email,
              trading_experience,
              trading_skill,
              description: value,
              additional,
            };
            const result = onChange(modelFields);
            value = result?.description ?? value;
          }
          if (errors.description?.hasError) {
            runValidationTasks("description", value);
          }
          setDescription(value);
        }}
        onBlur={() => runValidationTasks("description", description)}
        errorMessage={errors.description?.errorMessage}
        hasError={errors.description?.hasError}
        {...getOverrideProps(overrides, "description")}
      ></TextField>
      <TextField
        label="Additional"
        isRequired={false}
        isReadOnly={false}
        value={additional}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              full_name,
              email,
              trading_experience,
              trading_skill,
              description,
              additional: value,
            };
            const result = onChange(modelFields);
            value = result?.additional ?? value;
          }
          if (errors.additional?.hasError) {
            runValidationTasks("additional", value);
          }
          setAdditional(value);
        }}
        onBlur={() => runValidationTasks("additional", additional)}
        errorMessage={errors.additional?.errorMessage}
        hasError={errors.additional?.hasError}
        {...getOverrideProps(overrides, "additional")}
      ></TextField>
      <Flex
        justifyContent="space-between"
        {...getOverrideProps(overrides, "CTAFlex")}
      >
        <Button
          children="Clear"
          type="reset"
          onClick={(event) => {
            event.preventDefault();
            resetStateValues();
          }}
          {...getOverrideProps(overrides, "ClearButton")}
        ></Button>
        <Flex
          gap="15px"
          {...getOverrideProps(overrides, "RightAlignCTASubFlex")}
        >
          <Button
            children="Submit"
            type="submit"
            variation="primary"
            isDisabled={Object.values(errors).some((e) => e?.hasError)}
            {...getOverrideProps(overrides, "SubmitButton")}
          ></Button>
        </Flex>
      </Flex>
    </Grid>
  );
}
