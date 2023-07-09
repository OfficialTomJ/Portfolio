import React from "react";
import fs from "fs/promises";
import path from "path";
import grayMatter from "gray-matter";
import '../../app/globals.css';
import Footer from '../../Sections/PortfolioFooter';
import { PiArrowLeftThin } from "react-icons/pi";
import Link from "next/link";

const BlogPost = ({ frontmatter, content }) => {
  const paragraphs = content.split('\n\n'); // Split content into paragraphs

  // Function to check if a string is a valid URL
  const isURL = (str) => {
    try {
      new URL(str);
      return true;
    } catch (error) {
      return false;
    }
  };

// Function to parse links in the content
const parseLinks = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);

  if (!matches) {
    return text;
  }

  const parts = text.split(urlRegex);
  const parsedContent = parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {part}
        </a>
      );
    }
    return part;
  });

  return parsedContent;
};




  return (
    <>
      <main className="bg-zinc-800 min-h-screen flex align-middle justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0">
        <div className="container max-w-5xl">
          <Link href="/">
            <div className="flex items-center justify-start mt-8 cursor-pointer">
              <PiArrowLeftThin className="text-2xl mr-2 text-5xl" />
            </div>
          </Link>
          <h1 className="text-5xl mt-8 mb-2">{frontmatter.title}</h1>
          <p className="">{frontmatter.date}</p>
          <div className="mt-8 aspect-w-2 aspect-h-1">
            <img src={frontmatter.image} alt="Blog Image" className="object-cover max-h-[360px] w-full rounded-2xl" />
          </div>
          <div className="max-w-[60%] leading-7 mt-8">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="mb-8">
                {parseLinks(paragraph)}
              </p>
            ))}
          </div>
        </div>
      </main>
      <Footer></Footer>
    </>
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
