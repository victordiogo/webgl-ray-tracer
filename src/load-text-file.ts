export async function load_text_file(path: string): Promise<string> {
  const res = await fetch(path);
  return res.text();
}