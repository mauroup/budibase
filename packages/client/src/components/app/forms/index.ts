export { default as form } from "./Form.svelte"
export { default as fieldgroup } from "./FieldGroup.svelte"
export { default as stringfield } from "./StringField.svelte"
export { default as numberfield } from "./NumberField.svelte"
export { default as bigintfield } from "./BigIntField.svelte"
export { default as optionsfield } from "./OptionsField.svelte"
export { default as multifieldselect } from "./MultiFieldSelect.svelte"
export { default as booleanfield } from "./BooleanField.svelte"
export { default as longformfield } from "./LongFormField.svelte"
export { default as datetimefield } from "./DateTimeField.svelte"
export { default as attachmentfield } from "./AttachmentField.svelte"
export { default as attachmentsinglefield } from "./AttachmentSingleField.svelte"
export { default as relationshipfield } from "./RelationshipField.svelte"
export { default as passwordfield } from "./PasswordField.svelte"
export { default as formstep } from "./FormStep.svelte"
export { default as jsonfield } from "./JSONField.svelte"
export { default as s3upload } from "./S3Upload.svelte"
export { default as codescanner } from "./CodeScannerField.svelte"
export { default as signaturesinglefield } from "./SignatureField.svelte"
export { default as bbreferencefield } from "./BBReferenceField.svelte"
export { default as bbreferencesinglefield } from "./BBReferenceSingleField.svelte"

export interface FieldApi {
  setValue(value: any): boolean
  deregister(): void
}

export interface FieldState<T = any> {
  value: T
  fieldId: string
  disabled: boolean
  readonly: boolean
  error?: string
}
