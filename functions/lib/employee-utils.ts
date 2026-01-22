import type Employee from "@/types/employee";
import { UserRole } from "@/types/auth";

// Search employees by name or email
const searchEmployees = (
  employees: Employee[],
  query: string
): Employee[] => {
  if (!query.trim()) {
    return employees;
  }

  const searchTerm = query.toLowerCase().trim();

  return employees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(searchTerm) ||
      employee.email.toLowerCase().includes(searchTerm)
  );
};

// Filter employees by role
const filterEmployeesByRole = (
  employees: Employee[],
  role: UserRole | "all"
): Employee[] => {
  if (role === "all") {
    return employees;
  }

  return employees.filter((employee) => employee.role === role);
};

// Search and filter employees
const searchAndFilterEmployees = (
  employees: Employee[],
  searchQuery: string,
  roleFilter: UserRole | "all"
): Employee[] => {
  let result = employees;

  result = filterEmployeesByRole(result, roleFilter);
  result = searchEmployees(result, searchQuery);

  return result;
};

export { searchEmployees, filterEmployeesByRole, searchAndFilterEmployees };


