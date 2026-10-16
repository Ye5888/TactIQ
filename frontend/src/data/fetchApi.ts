// Shared request handling for the formation and draft scenes.
export async function fetchValidated<T>(
    url: string,
    validate: (data: unknown) => T,
    signal?: AbortSignal
): Promise<T> {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return validate(await response.json());
}
