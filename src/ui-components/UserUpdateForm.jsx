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
import { getUser } from "../graphql/queries";
import { updateUser } from "../graphql/mutations";
const client = generateClient();
export default function UserUpdateForm(props) {
  const {
    id: idProp,
    user: userModelProp,
    onSuccess,
    onError,
    onSubmit,
    onValidate,
    onChange,
    overrides,
    ...rest
  } = props;
  const initialValues = {
    id: "",
    discordID: "",
    discordUsername: "",
    discordGlobalName: "",
    discordAvatar: "",
  };
  const [id, setId] = React.useState(initialValues.id);
  const [discordID, setDiscordID] = React.useState(initialValues.discordID);
  const [discordUsername, setDiscordUsername] = React.useState(
    initialValues.discordUsername
  );
  const [discordGlobalName, setDiscordGlobalName] = React.useState(
    initialValues.discordGlobalName
  );
  const [discordAvatar, setDiscordAvatar] = React.useState(
    initialValues.discordAvatar
  );
  const [errors, setErrors] = React.useState({});
  const resetStateValues = () => {
    const cleanValues = userRecord
      ? { ...initialValues, ...userRecord }
      : initialValues;
    setId(cleanValues.id);
    setDiscordID(cleanValues.discordID);
    setDiscordUsername(cleanValues.discordUsername);
    setDiscordGlobalName(cleanValues.discordGlobalName);
    setDiscordAvatar(cleanValues.discordAvatar);
    setErrors({});
  };
  const [userRecord, setUserRecord] = React.useState(userModelProp);
  React.useEffect(() => {
    const queryData = async () => {
      const record = idProp
        ? (
            await client.graphql({
              query: getUser.replaceAll("__typename", ""),
              variables: { id: idProp },
            })
          )?.data?.getUser
        : userModelProp;
      setUserRecord(record);
    };
    queryData();
  }, [idProp, userModelProp]);
  React.useEffect(resetStateValues, [userRecord]);
  const validations = {
    id: [{ type: "Required" }],
    discordID: [],
    discordUsername: [],
    discordGlobalName: [],
    discordAvatar: [],
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
          id,
          discordID: discordID ?? null,
          discordUsername: discordUsername ?? null,
          discordGlobalName: discordGlobalName ?? null,
          discordAvatar: discordAvatar ?? null,
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
            query: updateUser.replaceAll("__typename", ""),
            variables: {
              input: {
                id: userRecord.id,
                ...modelFields,
              },
            },
          });
          if (onSuccess) {
            onSuccess(modelFields);
          }
        } catch (err) {
          if (onError) {
            const messages = err.errors.map((e) => e.message).join("\n");
            onError(modelFields, messages);
          }
        }
      }}
      {...getOverrideProps(overrides, "UserUpdateForm")}
      {...rest}
    >
      <TextField
        label="Id"
        isRequired={true}
        isReadOnly={true}
        value={id}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id: value,
              discordID,
              discordUsername,
              discordGlobalName,
              discordAvatar,
            };
            const result = onChange(modelFields);
            value = result?.id ?? value;
          }
          if (errors.id?.hasError) {
            runValidationTasks("id", value);
          }
          setId(value);
        }}
        onBlur={() => runValidationTasks("id", id)}
        errorMessage={errors.id?.errorMessage}
        hasError={errors.id?.hasError}
        {...getOverrideProps(overrides, "id")}
      ></TextField>
      <TextField
        label="Discord id"
        isRequired={false}
        isReadOnly={false}
        value={discordID}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              discordID: value,
              discordUsername,
              discordGlobalName,
              discordAvatar,
            };
            const result = onChange(modelFields);
            value = result?.discordID ?? value;
          }
          if (errors.discordID?.hasError) {
            runValidationTasks("discordID", value);
          }
          setDiscordID(value);
        }}
        onBlur={() => runValidationTasks("discordID", discordID)}
        errorMessage={errors.discordID?.errorMessage}
        hasError={errors.discordID?.hasError}
        {...getOverrideProps(overrides, "discordID")}
      ></TextField>
      <TextField
        label="Discord username"
        isRequired={false}
        isReadOnly={false}
        value={discordUsername}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              discordID,
              discordUsername: value,
              discordGlobalName,
              discordAvatar,
            };
            const result = onChange(modelFields);
            value = result?.discordUsername ?? value;
          }
          if (errors.discordUsername?.hasError) {
            runValidationTasks("discordUsername", value);
          }
          setDiscordUsername(value);
        }}
        onBlur={() => runValidationTasks("discordUsername", discordUsername)}
        errorMessage={errors.discordUsername?.errorMessage}
        hasError={errors.discordUsername?.hasError}
        {...getOverrideProps(overrides, "discordUsername")}
      ></TextField>
      <TextField
        label="Discord global name"
        isRequired={false}
        isReadOnly={false}
        value={discordGlobalName}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              discordID,
              discordUsername,
              discordGlobalName: value,
              discordAvatar,
            };
            const result = onChange(modelFields);
            value = result?.discordGlobalName ?? value;
          }
          if (errors.discordGlobalName?.hasError) {
            runValidationTasks("discordGlobalName", value);
          }
          setDiscordGlobalName(value);
        }}
        onBlur={() =>
          runValidationTasks("discordGlobalName", discordGlobalName)
        }
        errorMessage={errors.discordGlobalName?.errorMessage}
        hasError={errors.discordGlobalName?.hasError}
        {...getOverrideProps(overrides, "discordGlobalName")}
      ></TextField>
      <TextField
        label="Discord avatar"
        isRequired={false}
        isReadOnly={false}
        value={discordAvatar}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              discordID,
              discordUsername,
              discordGlobalName,
              discordAvatar: value,
            };
            const result = onChange(modelFields);
            value = result?.discordAvatar ?? value;
          }
          if (errors.discordAvatar?.hasError) {
            runValidationTasks("discordAvatar", value);
          }
          setDiscordAvatar(value);
        }}
        onBlur={() => runValidationTasks("discordAvatar", discordAvatar)}
        errorMessage={errors.discordAvatar?.errorMessage}
        hasError={errors.discordAvatar?.hasError}
        {...getOverrideProps(overrides, "discordAvatar")}
      ></TextField>
      <Flex
        justifyContent="space-between"
        {...getOverrideProps(overrides, "CTAFlex")}
      >
        <Button
          children="Reset"
          type="reset"
          onClick={(event) => {
            event.preventDefault();
            resetStateValues();
          }}
          isDisabled={!(idProp || userModelProp)}
          {...getOverrideProps(overrides, "ResetButton")}
        ></Button>
        <Flex
          gap="15px"
          {...getOverrideProps(overrides, "RightAlignCTASubFlex")}
        >
          <Button
            children="Submit"
            type="submit"
            variation="primary"
            isDisabled={
              !(idProp || userModelProp) ||
              Object.values(errors).some((e) => e?.hasError)
            }
            {...getOverrideProps(overrides, "SubmitButton")}
          ></Button>
        </Flex>
      </Flex>
    </Grid>
  );
}
