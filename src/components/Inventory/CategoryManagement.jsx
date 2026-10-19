import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Download,
  RefreshCw,
  Tag,
  Edit3,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import { pageSession } from "../../lib/pageSession";
import StatCard from "../ui/stat-card";
import { Button } from "../ui/button";
import FilterBar from "../lists/FilterBar";
import ListPager from "../lists/ListPager";
import { pageFigures } from "../../lib/pagination";

import { downloadCSV, formatTime } from "../../utils/format";
import { ConfirmDialog, DataTable, Field, Modal, PageHeader, Panel, Pill, Select, TextInput, Textarea, useToasts } from "../accounting/kit";
import Can from "../shell/Can";

// What this screen keeps while the person visits another page and comes back (lib/pageSession.js): the search, and a half-filled
// new-category form. Held in memory for the tab; emptied at sign-out.
const session = pageSession("inventory-categories");

const blankForm = () => ({ name: "", description: "", status: "Active" });
// a form is worth keeping once the person has put something in it ("Active" is where it starts, not an entry)
const hasEntry = (draft) => Boolean(draft && (draft.name || draft.description || (draft.status && draft.status !== "Active")));

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  // the list is being asked for from the first frame: "No categories yet" must not show before the answer is in
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState(null);
  // the search and a half-filled new-category form come back as the person left them
  const [restoredDraft] = useState(() => {
    const draft = session.get("formData");
    return hasEntry(draft) ? { ...blankForm(), ...draft } : null;
  });
  const [searchTerm, setSearchTerm] = useState(() => session.get("searchTerm", "") || "");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [stats, setStats] = useState({
    totalCategories: 0,
    activeCategories: 0,
    inactiveCategories: 0,
  });
  const [formData, setFormData] = useState(() => restoredDraft || blankForm());
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notify, toastNode } = useToasts();
  const [isDraftSaved, setIsDraftSaved] = useState(() => Boolean(restoredDraft));
  const [lastSaveTime, setLastSaveTime] = useState(() => (restoredDraft ? session.get("lastSaveTime") : null));
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    categoryId: null,
    categoryName: "",
    isDeleting: false,
  });

  const formRef = useRef(null);

  // a search is sent once the person pauses, not on every key
  const [askedSearch, setAskedSearch] = useState(() => searchTerm.trim());
  useEffect(() => {
    const t = setTimeout(() => setAskedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Only the NEW-category form is kept: an edit is a change to a record the server holds, and kept as a draft it would come back
  // as a new category carrying another one's details. It is written at once (leaving the page inside the two seconds below must
  // not lose it); the two seconds only decide when the form says "saved".
  useEffect(() => {
    if (!showModal || isEditMode || !hasEntry(formData)) return undefined;
    const at = new Date().toISOString();
    session.set("formData", formData);
    session.set("lastSaveTime", at);
    const t = setTimeout(() => {
      setIsDraftSaved(true);
      setLastSaveTime(at);
    }, 2000);
    return () => clearTimeout(t);
  }, [formData, showModal, isEditMode]);

  useEffect(() => {
    session.set("searchTerm", searchTerm);
  }, [searchTerm]);

  // Every existing call site below reads `showToastMessage(message, type)` - kept as a thin wrapper over the
  // shared kit.useToasts() so none of them needed to change.
  const showToastMessage = useCallback((message, type = "success") => notify(message, type), [notify]);

  // The rows on the screen answer one question (a page of one search). The empty state is a claim about THAT question, so it is
  // drawn only once the answer to the question now being asked is in: after a page or a search changes there is one frame, before
  // the request starts, in which the old (possibly empty) rows would otherwise be read as the answer to the new one.
  const [answeredFor, setAnsweredFor] = useState("");
  const asking = `${page}|${askedSearch}|${pageSize}`;
  const categoryRequest = useRef(0);
  const fetchCategories = useCallback(
    async (showRefreshIndicator = false) => {
      const ask = ++categoryRequest.current;
      setIsLoading(showRefreshIndicator ? false : true);
      try {
        const params = {
          page,
          limit: pageSize,
          search: askedSearch || undefined,
        };
        const response = await axiosInstance.get("/categories/categories", { params });
        // an answer to a search the person has since changed is not shown
        if (ask !== categoryRequest.current) return;
        setCategories(response.data.data?.categories || []);
        setTotalPages(response.data.totalPages || 1);
        setTotalRows(Number(response.data.total) || 0);
        setAnsweredFor(`${page}|${askedSearch}|${pageSize}`);
        if (showRefreshIndicator) {
          showToastMessage("Data refreshed successfully!", "success");
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
        showToastMessage(
          error.response?.data?.message || "Failed to fetch categories",
          "error"
        );
      } finally {
        if (ask === categoryRequest.current) setIsLoading(false);
      }
    },
    [page, pageSize, askedSearch, showToastMessage]
  );

  const fetchStats = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/categories/categories/stats");
      setStats(
        response.data.data?.stats || {
          totalCategories: 0,
          activeCategories: 0,
          inactiveCategories: 0,
        }
      );
    } catch (error) {
      console.error("Error fetching stats:", error);
      showToastMessage("Failed to fetch statistics", "error");
    }
  }, [showToastMessage]);

  // each is asked for on its own: a new search or page must not fetch the cards again
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // a new search starts at the first page, and a page that no longer exists (the last row of the last page was deleted) falls back
  // to the last one, so the list is never "empty" while the categories are on another page
  useEffect(() => {
    setPage(1);
  }, [askedSearch]);
  useEffect(() => {
    if (!isLoading && page > totalPages) setPage(Math.max(1, totalPages));
  }, [isLoading, page, totalPages]);
  const filtersOn = Boolean(searchTerm.trim());
  // what the list on the screen was actually asked for: the wording of its empty state follows this, not the box, which can be
  // ahead of it by the pause above
  const listFiltered = Boolean(askedSearch);
  const clearFilters = () => {
    setSearchTerm("");
    setAskedSearch("");
  };

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
      setIsDraftSaved(false);
    },
    [errors]
  );

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.name) newErrors.name = "Category name is required";
    if (formData.description.length > 500)
      newErrors.description = "Description cannot exceed 500 characters";
    return newErrors;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData(blankForm());
    setErrors({});
    setShowModal(false);
    setIsEditMode(false);
    setEditCategoryId(null);
    setIsDraftSaved(false);
    setLastSaveTime(null);
    session.remove("formData");
    session.remove("lastSaveTime");
  }, []);

  const handleSubmit = useCallback(async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await axiosInstance.put(`/categories/categories/${editCategoryId}`, formData);
        showToastMessage("Category updated successfully!", "success");
      } else {
        await axiosInstance.post("/categories/categories", formData);
        showToastMessage("Category created successfully!", "success");
      }
      resetForm();
      fetchCategories();
      fetchStats();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || `Failed to ${isEditMode ? "update" : "create"} category`,
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, resetForm, isEditMode, editCategoryId, fetchCategories, fetchStats, showToastMessage]);

  const handleEdit = useCallback((category) => {
    setFormData({
      name: category.name,
      description: category.description || "",
      status: category.status,
    });
    setEditCategoryId(category._id);
    setIsEditMode(true);
    setShowModal(true);
    setTimeout(() => {
      if (formRef.current) {
        const firstInput = formRef.current.querySelector('input[name="name"]');
        if (firstInput) firstInput.focus();
      }
    }, 10);
  }, []);

  const showDeleteConfirmation = useCallback((categoryId, categoryName) => {
    setDeleteConfirmation({
      visible: true,
      categoryId,
      categoryName,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      categoryId: null,
      categoryName: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(`/categories/categories/${deleteConfirmation.categoryId}`);
      showToastMessage("Category deleted successfully!", "success");
      fetchCategories();
      fetchStats();
      hideDeleteConfirmation();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete category",
        "error"
      );
    } finally {
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteConfirmation.categoryId, fetchCategories, fetchStats, showToastMessage, hideDeleteConfirmation]);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return "";
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    return formatTime(time);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      // the shared exporter: it quotes cells and makes a name that begins with = + - @ text, not a formula
      downloadCSV(
        "categories_export.csv",
        ["CategoryID", "Name", "Description", "Status", "CreatedAt"],
        categories.map((c) => [c._id, c.name, c.description || "", c.status, c.createdAt])
      );

      showToastMessage("Categories exported successfully!", "success");
    } catch {
      showToastMessage("Failed to export data", "error");
    }
  }, [categories, showToastMessage]);

  const handleRefresh = useCallback(() => {
    fetchCategories(true);
    fetchStats();
  }, [fetchCategories, fetchStats]);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Category Management"
        description={`${stats.totalCategories} total categories • ${categories.length} displayed`}
        actions={
          <>
            <button
              type="button"
              onClick={handleExport}
              className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              title="Export to CSV"
              aria-label="Export to CSV"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 mb-8">
        {[
          {
            title: "Total Categories",
            count: stats.totalCategories,
            icon: <Tag size={24} />,
          },
          {
            title: "Active Categories",
            count: stats.activeCategories,
            icon: <CheckCircle2 size={24} />,
          },
          {
            title: "Inactive Categories",
            count: stats.inactiveCategories,
            icon: <XCircle size={24} />,
          },
        ].map((card, index) => (
          <StatCard
              key={index}
              title={card.title}
              count={card.count}
              icon={card.icon}
              subText={card.subText}
              tone={["teal", "plum", "olive", "rose"][index % 4]}
              onClick={card.onClick}
            />
          ))}
      </div>

      <Panel
        bodyClassName="p-0"
        title="Category List"
        description="Manage all inventory categories"
        actions={
          <Can permission="inventory.create">
            <Button
              onClick={() => {
                setShowModal(true);
                setIsEditMode(false);
                setEditCategoryId(null);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Category
            </Button>
          </Can>
        }
      >
        <div className="border-b border-border p-4 sm:p-6">
          {/* The search: always showing, the same row every list of the product has (components/lists/FilterBar.jsx). It has no other
              choice to offer: a category has a name, a description and a status, and the server searches the first two. */}
          <FilterBar
            search={searchTerm}
            onSearch={setSearchTerm}
            searchLabel="Search categories"
            placeholder="Search name or description…"
            active={filtersOn}
            onClear={clearFilters}
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 size={32} className="animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading categories...</span>
          </div>
        )}

        {!isLoading && (
          <div className="overflow-x-auto">
            <DataTable
              caption="Categories"
              rows={categories}
              rowKey={(category) => category._id}
              columns={[
                {
                  key: "name", header: "Category Name", card: "primary",
                  cell: (category) => (
                    <div className="flex items-center space-x-3">
                      <div className="rounded-lg bg-secondary p-2">
                        <Tag size={16} className="text-muted-foreground" />
                      </div>
                      <p className="font-semibold text-foreground">{category.name}</p>
                    </div>
                  ),
                },
                { key: "description", header: "Description", card: "title", cell: (category) => <p className="text-sm text-muted-foreground">{category.description || "No description"}</p> },
                {
                  key: "status", header: "Status", card: "badge",
                  cell: (category) => <Pill tone={category.status === "Active" ? "success" : "danger"}>{category.status}</Pill>,
                },
                {
                  key: "actions", header: "Actions", align: "center", card: "actions",
                  cell: (category) => (
                    <div className="flex justify-center space-x-2">
                      <Can permission="inventory.edit"><button onClick={() => handleEdit(category)} className="rounded-lg p-2 text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground" title="Edit Category"><Edit3 size={16} /></button></Can>
                      <Can permission="inventory.delete"><button onClick={() => showDeleteConfirmation(category._id, category.name)} className="rounded-lg p-2 text-status-danger transition-colors duration-200 hover:bg-status-danger-soft" title="Delete Category"><Trash2 size={16} /></button></Can>
                    </div>
                  ),
                },
              ]}
            />

            {/* not before the answer to this page and search is in, and not while the page is about to fall back to the last one
                (the categories are there, on another page) */}
            {categories.length === 0 && answeredFor === asking && page <= totalPages && (
              <div className="text-center py-12">
                <Tag size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-foreground">
                  {listFiltered ? "No categories match the search or filters" : "No categories yet"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {listFiltered ? (
                    "Clear the search to see every category."
                  ) : (
                    <Can permission="inventory.create" fallback="Categories your team adds will be listed here.">
                      Add a category to start the list.
                    </Can>
                  )}
                </p>
                {listFiltered && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-accent">
                      Clear search and filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isLoading && categories.length > 0 && (
          <ListPager
            figures={pageFigures({ page, size: pageSize, total: totalRows })}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            noun="categories"
            one="category"
            className="rounded-none border-0 border-t shadow-none"
          />
        )}
      </Panel>

      {showModal && (
        <Modal
          size="lg"
          title={isEditMode ? "Edit Category" : "Add Category"}
          description={isEditMode ? "Update an existing inventory category" : "Create a new inventory category"}
          onClose={resetForm}
          footer={
            <>
              <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                {isSubmitting ? (isEditMode ? "Updating..." : "Creating...") : isEditMode ? "Update Category" : "Create Category"}
              </Button>
            </>
          }
        >
          <div className="grid gap-4" ref={formRef}>
            {/* a new category is kept as a draft; an edit is not (nothing is saved until Update) */}
            {!isEditMode && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {isDraftSaved && lastSaveTime && (
                  <span className="flex items-center text-status-success">
                    <CheckCircle2 size={12} className="mr-1" aria-hidden="true" />
                    Draft saved {formatLastSaveTime(lastSaveTime)}
                  </span>
                )}
                {isDraftSaved ? (
                  <span className="flex items-center text-status-success">
                    <CheckCircle2 size={14} className="mr-1" aria-hidden="true" />
                    Changes saved automatically
                  </span>
                ) : formData.name || formData.description ? (
                  <span className="flex items-center text-status-warning">
                    <AlertCircle size={14} className="mr-1" aria-hidden="true" />
                    Unsaved changes
                  </span>
                ) : null}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category Name" required error={errors.name}>
                <TextInput data-autofocus name="name" value={formData.name} onChange={handleChange} placeholder="Enter category name" />
              </Field>
              <Field label="Status">
                <Select name="status" value={formData.status} onChange={handleChange}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </Field>
            </div>

            <Field label="Description" error={errors.description}>
              <Textarea name="description" value={formData.description} onChange={handleChange} placeholder="Optional description..." rows={4} />
            </Field>
          </div>
        </Modal>
      )}

      {deleteConfirmation.visible && (
        <ConfirmDialog
          title="Delete Category"
          text={`Are you sure you want to delete "${deleteConfirmation.categoryName}"? This action cannot be undone and will permanently remove the category from your inventory.`}
          confirmLabel="Delete"
          danger
          busy={deleteConfirmation.isDeleting}
          onClose={hideDeleteConfirmation}
          onConfirm={confirmDelete}
        />
      )}

      {toastNode}
    </div>
  );
};

export default CategoryManagement;