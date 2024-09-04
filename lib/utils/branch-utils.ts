export function generateBranchName(projectName: string, featureName: string, suffix?: string | number): string {
  // Remove special characters and spaces, convert to lowercase
  const sanitizedProjectName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const sanitizedFeatureName = featureName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  // Truncate names if they're too long
  const maxLength = 30;
  const truncatedProjectName = sanitizedProjectName.slice(0, maxLength);
  const truncatedFeatureName = sanitizedFeatureName.slice(0, maxLength);
  
  // Combine project name and feature name
  let branchName = `${truncatedProjectName}/${truncatedFeatureName}`;
  
  // Add suffix if provided
  if (suffix !== undefined) {
    branchName += `-${suffix}`;
  }
  
  return branchName;
}