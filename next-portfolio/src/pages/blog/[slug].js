import React from "react";
import fs from "fs/promises";
import path from "path";
import grayMatter from "gray-matter";

const BlogPost = ({ frontmatter, content }) => {
  return (
    <div>
      <h1>{frontmatter.title}</h1>
      <p>{frontmatter.date}</p>
      <img src={frontmatter.image} alt="Blog Image" />
      <div>{content}</div>
    </div>
  );
};

export async function getStaticPaths() {
  const postsDirectory = path.join(process.cwd(), "src", "posts");
  const filenames = await fs.readdir(postsDirectory);
  const paths = filenames.map((filename) => ({
    params: { slug: filename.replace(/\.md$/, "") },
  }));

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const { slug } = params;
  const filePath = path.join(process.cwd(), "src", "posts", `${slug}.md`);
  const fileContents = await fs.readFile(filePath, "utf8");
  const { data, content } = grayMatter(fileContents);

  return {
    props: {
      frontmatter: {
        ...data,
        date: data.date.toString(),
      },
      content,
    },
  };
}

export default BlogPost;
